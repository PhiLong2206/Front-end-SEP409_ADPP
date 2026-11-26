import React from "react";

export interface LoadingProps {
  fullScreen?: boolean;
  message?: string;
}

const Loading: React.FC<LoadingProps> = ({
  fullScreen = false,
  message = "Đang tải dữ liệu...",
}) => {
  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm gap-3">
        <div className="w-10 h-10 border-4 border-[#0B5ED7] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-slate-700">{message}</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-8 gap-3">
      <div className="w-6 h-6 border-3 border-[#0B5ED7] border-t-transparent rounded-full animate-spin" />
      <span className="text-sm font-medium text-slate-600">{message}</span>
    </div>
  );
};

export default Loading;
