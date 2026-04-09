<template>
  <div class="bd">
    <div class="bd-header">
      <span class="bd-partnum">AGI-2007</span>
      <span class="bd-desc-head">ARGHUNTER SYSTEM ARCHITECTURE · REV A</span>
      <span class="bd-pkg">PKG: Cambridge MA</span>
    </div>

    <div class="bd-grid">
      <!-- vertical center trace -->
      <div class="bd-trace-v"></div>
      <!-- horizontal center trace -->
      <div class="bd-trace-h"></div>
      <!-- junction dot -->
      <div class="bd-junction"></div>

      <div class="bd-block">
        <div class="bd-block-ref">U1</div>
        <div class="bd-block-name">ASIC / CHIP DESIGN</div>
        <div class="bd-block-body">130nm Skywater CMOS · 8 chips on Tiny Tapeout 8 · Beamforming &amp; audio DSP ASICs</div>
        <div class="bd-pin bd-pin-out">I²S/PDM ──▶</div>
      </div>

      <div class="bd-block">
        <div class="bd-block-ref">U2</div>
        <div class="bd-block-name">SIGNAL PROCESSING</div>
        <div class="bd-block-body">PDM bitstream operators · 250× runtime gain · MSMVDR · 9.9 dB SNR improvement · 256 ch ADC Streaming</div>
        <div class="bd-pin bd-pin-in">◀── RX</div>
      </div>

      <div class="bd-block">
        <div class="bd-block-ref">U3</div>
        <div class="bd-block-name">COMPUTER ARCH</div>
        <div class="bd-block-body"> · RV32-IM pipelined CPU · DNN accelerators · Acoustic Camera accel · PDM MAC Operators</div>
        <div class="bd-pin bd-pin-out">AXI ──▶</div>
      </div>

      <div class="bd-block">
        <div class="bd-block-ref">U4</div>
        <div class="bd-block-name">PHYSICAL SYSTEMS</div>
        <div class="bd-block-body">FPGA server cluster · Beamforming Hearing Aids · MIT Motorsports Formula SAE · MIT Satellite Team</div>
        <div class="bd-pin bd-pin-in">◀── EN</div>
      </div>
    </div>

    <div class="bd-footer">
      <span>VCC: MIT EECS '29</span>
      <span>T<sub>op</sub>: –40°C to +125°C</span>
      <span>STATUS: <span class="bd-status">ACTIVE</span></span>
    </div>
  </div>
</template>

<style scoped>
.bd {
  font-family: 'DM Mono', monospace;
  border: 1px solid var(--accent);
  margin: 1.5rem 0;
  position: relative;
}

/* Header bar */
.bd-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.35rem 0.75rem;
  border-bottom: 1px solid var(--accent);
  font-size: 0.6rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}
.bd-partnum  { color: var(--accent); font-weight: 600; }
.bd-desc-head { opacity: 0.7; }
.bd-pkg      { opacity: 0.55; }

/* 2×2 grid */
.bd-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  position: relative;
}

/* Center trace lines */
.bd-trace-v {
  position: absolute;
  left: 50%; top: 0; bottom: 0;
  width: 1px;
  background: color-mix(in srgb, var(--accent) 40%, transparent);
  pointer-events: none;
  z-index: 0;
}
.bd-trace-h {
  position: absolute;
  top: 50%; left: 0; right: 0;
  height: 1px;
  background: color-mix(in srgb, var(--accent) 40%, transparent);
  pointer-events: none;
  z-index: 0;
}
.bd-junction {
  position: absolute;
  left: 50%; top: 50%;
  transform: translate(-50%, -50%);
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--accent);
  z-index: 1;
  pointer-events: none;
}

/* Individual blocks */
.bd-block {
  padding: 0.75rem 1rem 0.4rem;
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-height: 7rem;
}

.bd-block-ref {
  font-size: 0.62rem;
  color: var(--accent);
  opacity: 0.7;
  letter-spacing: 0.12em;
}

.bd-block-name {
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--accent);
}

.bd-block-body {
  font-size: 0.88rem;
  line-height: 1.65;
  opacity: 0.85;
  flex: 1;
}

/* Signal pin labels */
.bd-pin {
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  opacity: 0.55;
  margin-top: auto;
  padding-top: 0.4rem;
  color: var(--accent);
}
.bd-pin-out { text-align: right; }
.bd-pin-in  { text-align: left; }

/* Footer bar */
.bd-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.35rem 0.75rem;
  border-top: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
  font-size: 0.58rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.6;
}
.bd-status {
  color: #4ade80;
  opacity: 1;
}

@media (max-width: 600px) {
  .bd-grid { grid-template-columns: 1fr; }
  .bd-trace-v, .bd-trace-h, .bd-junction { display: none; }
  .bd-block { border-bottom: 1px solid var(--hr-color); min-height: auto; }
  .bd-block:last-child { border-bottom: none; }
  .bd-header, .bd-footer { flex-direction: column; gap: 0.15rem; align-items: flex-start; }
}
</style>
