export function LoginLogo() {
  return (
    <div className="text-center mb-6">
      <div
        className="mx-auto w-[56px] h-[56px] rounded-full flex items-center justify-center mb-3"
        style={{
          background:
            'radial-gradient(circle at 40% 35%, rgba(56,180,255,0.45) 0%, rgba(8,24,56,0.95) 70%)',
          border: '2px solid rgba(56,189,248,0.65)',
          boxShadow:
            '0 0 0 4px rgba(14,80,160,0.25), 0 0 36px rgba(56,180,255,0.45)',
        }}
      >
        <div
          className="w-[18px] h-[18px] rounded-full"
          style={{
            border: '2.5px solid #7dd3fc',
            boxShadow: 'inset 0 0 10px #38bdf8, 0 0 8px #38bdf8',
          }}
        />
      </div>
      <h1
        className="text-[26px] font-semibold tracking-[0.28em] text-white"
        style={{ textShadow: '0 0 24px rgba(56,180,255,0.35)' }}
      >
        ELYRA
      </h1>
      <p className="text-[12px] mt-1.5 text-sky-200/50">
        Laboratorio · PIN y biometría facial
      </p>
    </div>
  );
}
