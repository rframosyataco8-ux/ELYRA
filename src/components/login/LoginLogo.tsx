export function LoginLogo() {
  return (
    <div className="text-center mb-5">
      <div
        className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-3"
        style={{
          background:
            'radial-gradient(circle at 40% 35%, rgba(56,180,255,0.35) 0%, rgba(8,24,56,0.95) 72%)',
          border: '1.5px solid rgba(56,189,248,0.5)',
          boxShadow: '0 0 0 3px rgba(14,80,160,0.18), 0 0 24px rgba(56,180,255,0.28)',
        }}
      >
        <div
          className="w-3.5 h-3.5 rounded-full"
          style={{
            border: '2px solid #7dd3fc',
            boxShadow: 'inset 0 0 6px #38bdf8',
          }}
        />
      </div>
      <h1
        className="text-[22px] font-semibold tracking-[0.24em] text-white"
        style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
      >
        ELYRA
      </h1>
      <p className="text-[12px] mt-1.5 text-sky-200/45 font-normal">
        Laboratorio · PIN y biometría facial
      </p>
    </div>
  );
}
