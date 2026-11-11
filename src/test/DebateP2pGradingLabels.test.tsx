import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, configure } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import DebateRoom from "../pages/debater/DebatePractice/DebateRoom";
import DebateResult from "../pages/debater/DebatePractice/DebateResult";
import { getSpeakerRelation } from "../utils/debateSpeaker";

window.HTMLElement.prototype.scrollIntoView = vi.fn();

// These tests render the whole room with real timers; the first render is slow when the full suite runs.
configure({ asyncUtilTimeout: 4000 });

const ME = 1;
const MY_NAME = "Nguyen Van A";

const SIGNED_IN_USER = { userId: 1, id: 1, fullName: "Nguyen Van A", role: "Debater" };
let mockAuthUser: { userId?: number; id?: string | number; fullName: string; role: string } | null =
  SIGNED_IN_USER;

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    user: mockAuthUser,
    isAuthenticated: true,
  }),
}));

const mockGetSessionDetails = vi.fn();
const mockGetTranscript = vi.fn();
const mockEvaluateDebateRound = vi.fn();
const mockEvaluateDebateSession = vi.fn();
const mockEvaluateSpeechArgument = vi.fn();
const mockGetEvaluation = vi.fn();

vi.mock("../api", () => ({
  aiApi: {
    createOpponentSession: vi.fn(),
    getOpponentCasePlan: vi.fn(),
    getOpponentSession: vi.fn(),
    generateOpponentTurn: vi.fn(),
    evaluateSpeechArgument: (...args: unknown[]) => mockEvaluateSpeechArgument(...args),
    evaluateDebateRound: (...args: unknown[]) => mockEvaluateDebateRound(...args),
    evaluateDebateSession: (...args: unknown[]) => mockEvaluateDebateSession(...args),
  },
  debateApi: {
    getSessionDetails: (...args: unknown[]) => mockGetSessionDetails(...args),
    getTranscript: (...args: unknown[]) => mockGetTranscript(...args),
    getEvaluation: (...args: unknown[]) => mockGetEvaluation(...args),
    getPendingSwapRequests: vi.fn().mockResolvedValue({ success: true, data: [] }),
    submitArgument: vi.fn(),
    startDebateSession: vi.fn(),
  },
}));

interface Participant {
  userId: number | null;
  side: number;
  speakerName: string;
  isAI?: boolean;
}

interface Argument {
  argumentId: number;
  turnOrder: number;
  stage: number;
  side: number;
  speakerName: string;
  isAI: boolean;
  content: string;
  submittedAt: string;
  userId?: number;
}

const PRO = 1;
const CON = 2;
const COMPLETED = 3;
const IN_PROGRESS = 2;
const OPPONENT = "Tran Thi B";
const TEAMMATE = "Le Van C";
const OPPONENT_2 = "Pham Thi D";

let nextArgumentId = 1;
const arg = (stage: number, side: number, speakerName: string, content: string, userId?: number): Argument => ({
  argumentId: nextArgumentId++,
  turnOrder: stage,
  stage,
  side,
  speakerName,
  isAI: false,
  content,
  submittedAt: "2026-11-03T10:00:00Z",
  ...(userId === undefined ? {} : { userId }),
});

const oneVsOne: Participant[] = [
  { userId: ME, side: PRO, speakerName: MY_NAME },
  { userId: 2, side: CON, speakerName: OPPONENT },
];

const twoVsTwo: Participant[] = [
  { userId: ME, side: PRO, speakerName: MY_NAME },
  { userId: 3, side: PRO, speakerName: TEAMMATE },
  { userId: 2, side: CON, speakerName: OPPONENT },
  { userId: 4, side: CON, speakerName: OPPONENT_2 },
];

/** Full 1v1 transcript: both players speak once in each of the 3 rounds. */
const fullOneVsOne = (mySide = PRO): Argument[] =>
  [1, 2, 3].flatMap((stage) => [
    arg(stage, mySide, MY_NAME, `Tôi vòng ${stage}`),
    arg(stage, mySide === PRO ? CON : PRO, OPPONENT, `Đối thủ vòng ${stage}`),
  ]);

/** Full 2v2 transcript. `myRounds` are the rounds I speak in; my teammate takes my slot in the others. */
const fullTwoVsTwo = (myRounds = [1, 2, 3]): Argument[] =>
  [1, 2, 3].flatMap((stage) => [
    myRounds.includes(stage)
      ? arg(stage, PRO, MY_NAME, `Tôi vòng ${stage}`)
      : arg(stage, PRO, TEAMMATE, `Đồng đội thay tôi vòng ${stage}`),
    arg(stage, CON, OPPONENT, `Đối thủ 1 vòng ${stage}`),
    arg(stage, PRO, TEAMMATE, `Đồng đội vòng ${stage}`),
    arg(stage, CON, OPPONENT_2, `Đối thủ 2 vòng ${stage}`),
  ]);

let currentTranscript: Argument[] = [];
let currentSession: Record<string, unknown> = {};

const seedSession = (
  debateType: number | string,
  participants: Participant[],
  args: Argument[],
  overrides: Record<string, unknown> = {}
) => {
  currentSession = {
    sessionId: 123,
    title: "Phòng tranh biện",
    topic: "Mạng xã hội có hại hơn lợi?",
    status: COMPLETED,
    debateType,
    currentStage: 3,
    currentTurnSide: 1,
    currentTurn: null,
    createdByUserId: ME,
    participants: participants.map((p) => ({ isAI: false, ...p })),
    ...overrides,
  };
  currentTranscript = args;
};

const renderRoom = (entry = "/debater/debate/123") =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/debater/debate/:sessionId" element={<DebateRoom />} />
        <Route
          path="/debater/debate/:sessionId/result"
          element={
            <>
              <div data-testid="result-page" />
              <DebateResult />
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  );

const clickSubmitOnce = async (speech: string) => {
  await screen.findByText(speech);
  const btn = await screen.findByTestId("header-submit-debate-btn");
  await waitFor(() => expect(btn).not.toBeDisabled());
  fireEvent.click(btn);
};

/** Waits until the given speech is on screen, submits, and waits for the result page. */
const submitOnceLoaded = async (speech: string) => {
  await clickSubmitOnce(speech);
  await screen.findByTestId("result-page");
};

const STAGES = ["opening", "rebuttal", "closing"];

/** One side of the official result (GET /evaluation), score 0-10. */
const sideEvaluation = (side: string, overallScore: number, skippedStages: string[] = []) => ({
  side,
  speakerName: side,
  overallScore,
  stageBreakdown: Object.fromEntries(STAGES.filter((s) => !skippedStages.includes(s)).map((s) => [s, overallScore])),
  skippedStages,
  progressTrend: `xu hướng ${side}`,
  strengths: [`điểm mạnh ${side}`],
  weaknesses: [],
  suggestions: [],
  roundEvaluations: STAGES.filter((s) => !skippedStages.includes(s)).map((stage, i) => ({
    roundNumber: i + 1,
    stage,
    roundScore: overallScore,
    consistencyNote: "",
    criteria: [{ name: "Logic", score: 4, reasoning: "Tốt" }],
    strengths: [],
    weaknesses: [],
    suggestions: [],
    evidenceChecks: [],
  })),
});

/** PRO 8/10 (shown as 80), CON 6/10 (shown as 60): the page must show the user's side. */
const officialResult = (overrides: Record<string, unknown> = {}) => ({
  success: true,
  message: "ok",
  data: {
    judgementId: 9,
    sessionId: 123,
    suggestedWinnerSide: "PRO",
    overallScorePro: 8,
    overallScoreCon: 6,
    evaluatedAt: "2026-11-11T10:00:00Z",
    proEvaluation: sideEvaluation("PRO", 8),
    conEvaluation: sideEvaluation("CON", 6),
    ...overrides,
  },
});

/** The big circular overall score of the result page, once it has loaded GET /evaluation. */
const shownScore = async () => (await screen.findByTestId("result-overall-score")).textContent;

describe("Final grading reads the official result (GET /evaluation) and shows the user's side", () => {
  beforeEach(() => {
    nextArgumentId = 1;
    mockAuthUser = SIGNED_IN_USER;
    sessionStorage.clear();
    localStorage.clear();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mockGetSessionDetails.mockImplementation(async () => ({ success: true, data: currentSession }));
    mockGetTranscript.mockImplementation(async () => ({
      success: true,
      data: { arguments: currentTranscript },
    }));
    mockGetEvaluation.mockResolvedValue(officialResult());
    mockEvaluateSpeechArgument.mockResolvedValue({
      overall_score: 8,
      overall_reasoning: "Tốt",
      criteria: [],
      strengths: [],
      weaknesses: [],
      suggestions: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe("with the debateType the Backend will return", () => {
    it.each([
      ["1v1 P2pMatch (số)", 2, false],
      ["1v1 P2pMatch (chuỗi)", "P2pMatch", false],
      ["1v1 Direct1v1 (số)", 3, false],
      ["1v1 Direct1v1 (chuỗi)", "Direct1v1", false],
      ["2v2 (số)", 2, true],
    ])("%s: one GET /evaluation, no direct evaluator call, my side's score", async (_name, debateType, isTwoVsTwo) => {
      seedSession(debateType, isTwoVsTwo ? twoVsTwo : oneVsOne, isTwoVsTwo ? fullTwoVsTwo() : fullOneVsOne());
      renderRoom();
      await submitOnceLoaded("Tôi vòng 1");

      expect(await shownScore()).toBe("80");
      expect(mockGetEvaluation).toHaveBeenCalledTimes(1); // by the result page, not by the room
      expect(mockGetEvaluation).toHaveBeenCalledWith(123);
      expect(mockEvaluateDebateRound).not.toHaveBeenCalled();
      expect(mockEvaluateDebateSession).not.toHaveBeenCalled();
      expect(await shownScore()).toBe("80");
      expect(screen.getByText("xu hướng PRO")).toBeInTheDocument();
    });

    it("AI session: my side comes from the Backend (CON here)", async () => {
      seedSession(1, [
        { userId: ME, side: CON, speakerName: MY_NAME },
        { userId: null, side: PRO, speakerName: "AI Opponent", isAI: true },
      ], []);
      const local = (id: string, speaker: string, roundNumber: number, content: string) => ({
        id,
        speaker,
        speakerName: speaker === "AI" ? "Đối thủ AI" : "Bạn",
        side: speaker === "AI" ? "Ủng hộ" : "Phản đối",
        stage: "Mở đầu",
        roundNumber,
        timestamp: "",
        content,
      });
      sessionStorage.setItem(
        "adpp_messages_123",
        JSON.stringify(
          [1, 2, 3].flatMap((r) => [
            local(`ai-${r}`, "AI", r, `AI vòng ${r}`),
            local(`me-${r}`, "Debater", r, `Tôi vòng ${r}`),
          ])
        )
      );
      sessionStorage.setItem("adpp_debate_completed_123", "1");
      sessionStorage.setItem("adpp_current_round_123", "3");
      renderRoom();
      await submitOnceLoaded("Tôi vòng 1");

      expect(await shownScore()).toBe("60");
      expect(screen.getByText("xu hướng CON")).toBeInTheDocument();
    });
  });

  describe("the debate ends while I am in the room", () => {
    it("the other side's last turn (seen by polling) opens my result page by itself", async () => {
      seedSession(2, oneVsOne, fullOneVsOne().slice(0, 5), { status: IN_PROGRESS, currentTurn: { turnId: 6 } });
      renderRoom();
      await screen.findByText("Tôi vòng 3");
      expect(screen.queryByTestId("result-page")).not.toBeInTheDocument();

      // The opponent submits the last turn: the Backend completes the session and grades it in the background
      seedSession(2, oneVsOne, fullOneVsOne());

      await screen.findByTestId("result-page", undefined, { timeout: 8000 });
      expect(await shownScore()).toBe("80");
    });
  });

  describe("who is who", () => {
    it("1v1 from the CON player's seat: the CON result", async () => {
      seedSession(
        2,
        [
          { userId: 2, side: PRO, speakerName: OPPONENT },
          { userId: ME, side: CON, speakerName: MY_NAME },
        ],
        fullOneVsOne(CON)
      );
      renderRoom();
      await submitOnceLoaded("Tôi vòng 1");

      expect(await shownScore()).toBe("60");
    });

    it("a string account id matches the numeric participant id", async () => {
      seedSession(2, oneVsOne, fullOneVsOne());
      mockAuthUser = { id: "1", fullName: MY_NAME, role: "Debater" };
      renderRoom();
      await submitOnceLoaded("Tôi vòng 1");

      expect(await shownScore()).toBe("80");
    });

    it("account id 0 is a real id, not 'still loading'", async () => {
      seedSession(
        2,
        [
          { userId: 0, side: PRO, speakerName: MY_NAME },
          { userId: 2, side: CON, speakerName: OPPONENT },
        ],
        fullOneVsOne()
      );
      mockAuthUser = { userId: 0, fullName: MY_NAME, role: "Debater" };
      renderRoom();
      await submitOnceLoaded("Tôi vòng 1");

      expect(await shownScore()).toBe("80");
    });

    it("a signed-in user missing from the participants gets no result (no guessed side)", async () => {
      seedSession(
        2,
        [
          { userId: 7, side: PRO, speakerName: "Người khác" },
          { userId: 2, side: CON, speakerName: OPPONENT },
        ],
        fullOneVsOne()
      );
      renderRoom();
      await clickSubmitOnce("Tôi vòng 1");

      expect((await screen.findAllByText(/bạn không tham gia phiên tranh biện này/)).length).toBeGreaterThan(0);
      expect(mockGetEvaluation).not.toHaveBeenCalled();
      expect(screen.queryByTestId("result-page")).not.toBeInTheDocument();
    });

    it("getSpeakerRelation: userId is authoritative over a misleading side and name", () => {
      const speech = { side: PRO, speakerName: MY_NAME };

      expect(getSpeakerRelation({ ...speech, speakerUserId: ME }, twoVsTwo, ME)).toBe("self");
      expect(getSpeakerRelation({ ...speech, speakerUserId: 3 }, twoVsTwo, ME)).toBe("teammate");
      expect(getSpeakerRelation({ ...speech, speakerUserId: 2 }, twoVsTwo, ME)).toBe("opponent");
      expect(getSpeakerRelation({ ...speech, speakerUserId: 99 }, twoVsTwo, ME)).toBe("unknown");
    });

    it("getSpeakerRelation: without userId it falls back to side + name, and a null userId counts as absent", () => {
      expect(getSpeakerRelation({ side: "PRO", speakerName: MY_NAME }, twoVsTwo, ME)).toBe("self");
      expect(getSpeakerRelation({ side: PRO, speakerName: TEAMMATE, speakerUserId: null }, twoVsTwo, ME)).toBe(
        "teammate"
      );
      expect(getSpeakerRelation({ side: "Phản đối", speakerName: OPPONENT }, twoVsTwo, ME)).toBe("opponent");
    });
  });

  describe("a stage I did not speak in", () => {
    it("shows 'Không phát biểu' for the stage the Backend reports as skipped", async () => {
      seedSession(2, twoVsTwo, fullTwoVsTwo([1, 3]));
      mockGetEvaluation.mockResolvedValue(officialResult({ proEvaluation: sideEvaluation("PRO", 8, ["rebuttal"]) }));
      renderRoom();
      await submitOnceLoaded("Tôi vòng 1");
      await shownScore();

      expect(screen.getAllByText("Không phát biểu")).toHaveLength(1);
      expect(screen.getByText("Phản biện")).toBeInTheDocument();
    });

    it("if I never spoke (no evaluation for my side, score 0), all three stages show 'Không phát biểu'", async () => {
      seedSession(2, twoVsTwo, fullTwoVsTwo([]));
      mockGetEvaluation.mockResolvedValue(officialResult({ proEvaluation: null, overallScorePro: 0 }));
      renderRoom();
      await submitOnceLoaded("Đối thủ 1 vòng 1");
      await shownScore();

      expect(screen.getAllByText("Không phát biểu")).toHaveLength(3);
      expect(await shownScore()).toBe("0");
    });
  });

  describe("error handling", () => {
    it("the official result is not ready (404): the result page says so with a retry, which shows it once it is", async () => {
      seedSession(2, oneVsOne, fullOneVsOne());
      mockGetEvaluation.mockRejectedValueOnce({ success: false, status: 404, message: "No evaluation found for this debate session." });
      renderRoom();
      await submitOnceLoaded("Tôi vòng 1");

      expect(await screen.findByTestId("result-load-error")).toHaveTextContent("No evaluation found");
      fireEvent.click(screen.getByTestId("result-retry-btn"));

      expect(await shownScore()).toBe("80");
      expect(mockGetEvaluation).toHaveBeenCalledTimes(2);
    });

    it("temporary error (account not loaded yet): offers a retry, which works once it loads", async () => {
      seedSession(2, oneVsOne, fullOneVsOne());
      mockAuthUser = null;
      const view = renderRoom();
      await clickSubmitOnce("Tôi vòng 1");

      const retry = await screen.findByTestId("retry-finish-evaluation-btn");
      expect(mockGetEvaluation).not.toHaveBeenCalled();

      mockAuthUser = SIGNED_IN_USER;
      view.rerender(
        <MemoryRouter initialEntries={["/debater/debate/123"]}>
          <Routes>
            <Route path="/debater/debate/:sessionId" element={<DebateRoom />} />
            <Route path="/debater/debate/:sessionId/result" element={<div data-testid="result-page" />} />
          </Routes>
        </MemoryRouter>
      );
      fireEvent.click(retry);
      await screen.findByTestId("result-page");
      expect(mockGetEvaluation).not.toHaveBeenCalled(); // the room only opens the result page
    });

    it("no query string: shows the loading screen while the session fails to load, and the room once it loads", async () => {
      seedSession(2, oneVsOne, fullOneVsOne(), { status: IN_PROGRESS });
      mockGetSessionDetails.mockRejectedValueOnce(new Error("mạng lỗi"));

      renderRoom();

      expect(await screen.findByTestId("debate-lobby-loading")).toBeInTheDocument();
      expect(mockGetTranscript).not.toHaveBeenCalled();

      expect(await screen.findByText("Tôi vòng 1")).toBeInTheDocument(); // the next poll succeeds
      expect(screen.queryByTestId("debate-lobby-loading")).not.toBeInTheDocument();
    });

    it("temporary error (session not loaded yet): offers a retry, which works once the session is back", async () => {
      seedSession(2, oneVsOne, fullOneVsOne());
      const local = (id: string, speaker: string, content: string) => ({
        id,
        speaker,
        speakerName: speaker,
        side: speaker === "AI" ? "Phản đối" : "Ủng hộ",
        stage: "Kết luận",
        roundNumber: 3,
        timestamp: "",
        content,
      });
      sessionStorage.setItem(
        "adpp_messages_123",
        JSON.stringify([local("a", "Debater", "Tôi đã lưu"), local("b", "AI", "Lưu của đối thủ")])
      );
      sessionStorage.setItem("adpp_debate_completed_123", "1");
      sessionStorage.setItem("adpp_current_round_123", "3");
      mockGetSessionDetails.mockRejectedValueOnce(new Error("mạng lỗi"));

      // With no query string the room only shows the loading screen, so grading is reachable only with one
      renderRoom("/debater/debate/123?motion=x");
      await clickSubmitOnce("Tôi đã lưu");

      const retry = await screen.findByTestId("retry-finish-evaluation-btn");
      expect(mockGetEvaluation).not.toHaveBeenCalled();

      await screen.findByText("Tôi vòng 1");
      fireEvent.click(retry);
      await screen.findByTestId("result-page");
      expect(await shownScore()).toBe("80");
    });
  });

  describe("the AI analysis button in the sidebar", () => {
    const requestAnalysis = async () => {
      fireEvent.click(await screen.findByLabelText("Gợi ý phản biện (AI Hints)"));
      fireEvent.click(await screen.findByText("AI Coaching"));
      fireEvent.click(await screen.findByText(/Yêu cầu phân tích AI/));
    };

    it("1v1: analyses my latest speech against the opponent's, even when the opponent spoke last", async () => {
      seedSession(2, oneVsOne, fullOneVsOne().slice(0, 4), { status: IN_PROGRESS, currentTurn: { turnId: 3 } });
      renderRoom();
      await screen.findByText("Đối thủ vòng 2");
      await requestAnalysis();

      await waitFor(() => expect(mockEvaluateSpeechArgument).toHaveBeenCalledTimes(1));
      expect(mockEvaluateSpeechArgument.mock.calls[0][0]).toMatchObject({
        side: "pro",
        stage: "rebuttal",
        argument_text: "Tôi vòng 2",
        opponent_argument_text: "Đối thủ vòng 2",
      });
    });

    it("2v2: a later speech by my teammate is neither mine nor the opponent's", async () => {
      seedSession(2, twoVsTwo, fullTwoVsTwo().slice(0, 3), { status: IN_PROGRESS, currentTurn: { turnId: 1 } });
      renderRoom();
      await screen.findByText("Đồng đội vòng 1");
      await requestAnalysis();

      await waitFor(() => expect(mockEvaluateSpeechArgument).toHaveBeenCalledTimes(1));
      expect(mockEvaluateSpeechArgument.mock.calls[0][0]).toMatchObject({
        argument_text: "Tôi vòng 1",
        opponent_argument_text: "Đối thủ 1 vòng 1",
      });
    });

    it("does nothing when only the opponent has spoken", async () => {
      seedSession(2, oneVsOne, [arg(1, CON, OPPONENT, "Đối thủ nói trước")], {
        status: IN_PROGRESS,
        currentTurn: { turnId: 1 },
      });
      renderRoom();
      await screen.findByText("Đối thủ nói trước");
      await requestAnalysis();

      expect(mockEvaluateSpeechArgument).not.toHaveBeenCalled();
    });

    it("AI session: analyses my latest speech against the AI's", async () => {
      seedSession(1, [
        { userId: ME, side: PRO, speakerName: MY_NAME },
        { userId: null, side: CON, speakerName: "AI Opponent", isAI: true },
      ], [], { status: IN_PROGRESS, currentTurn: { turnId: 2 } });
      sessionStorage.setItem(
        "adpp_messages_123",
        JSON.stringify([
          { id: "m", speaker: "Debater", speakerName: "Bạn", side: "Ủng hộ", stage: "Mở đầu", roundNumber: 1, timestamp: "", content: "Tôi vòng 1" },
          { id: "a", speaker: "AI", speakerName: "AI", side: "Phản đối", stage: "Mở đầu", roundNumber: 1, timestamp: "", content: "AI vòng 1" },
        ])
      );
      renderRoom();
      await screen.findByText("AI vòng 1");
      await requestAnalysis();

      await waitFor(() => expect(mockEvaluateSpeechArgument).toHaveBeenCalledTimes(1));
      expect(mockEvaluateSpeechArgument.mock.calls[0][0]).toMatchObject({
        argument_text: "Tôi vòng 1",
        opponent_argument_text: "AI vòng 1",
      });
    });
  });
});
