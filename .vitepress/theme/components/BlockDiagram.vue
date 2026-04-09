<template>
  <div class="bd">
    <!-- row 1 -->
    <div class="bd-pin bd-l">
      <div class="bd-pin-label">
        <span class="bd-ref">U1</span>
        <span class="bd-name">CHIP DESIGN</span>
        <span class="bd-desc">SKY130 · Tiny Tapeout 8 · beamforming ASICs</span>
      </div>
      <div class="bd-wire"></div>
    </div>
    <div class="bd-body-top">
      <div class="bd-notch"></div>
      <div class="bd-id">AGI-2007</div>
      <div class="bd-sys">ARGHUNTER</div>
    </div>
    <div class="bd-pin bd-r">
      <div class="bd-wire"></div>
      <div class="bd-pin-label bd-pin-label-r">
        <span class="bd-ref">U3</span>
        <span class="bd-name">COMP ARCH</span>
        <span class="bd-desc">RV32-IM CPU · DNN accel · PDM MAC ops</span>
      </div>
    </div>

    <!-- row 2 -->
    <div class="bd-pin bd-l">
      <div class="bd-pin-label">
        <span class="bd-ref">U2</span>
        <span class="bd-name">SIGNAL PROC</span>
        <span class="bd-desc">PDM operators · MSMVDR · 9.9 dB SNR</span>
      </div>
      <div class="bd-wire"></div>
    </div>
    <div class="bd-body-bot">
      <div class="bd-meta">
        <span>MIT EECS '29</span>
        <span class="bd-active">● ACTIVE</span>
      </div>
    </div>
    <div class="bd-pin bd-r">
      <div class="bd-wire"></div>
      <div class="bd-pin-label bd-pin-label-r">
        <span class="bd-ref">U4</span>
        <span class="bd-name">PHYS SYS</span>
        <span class="bd-desc">FPGA cluster · hearing aids · SAE · sat</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bd {
  font-family: 'DM Mono', monospace;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  margin: 1.25rem 0;
  font-size: 0.68rem;
}

/* ── Chip body (split into two cells so each row owns its half) ── */
.bd-body-top,
.bd-body-bot {
  min-width: 7.5rem;
  padding: 0.45rem 0.9rem;
  border-left: 1px solid var(--accent);
  border-right: 1px solid var(--accent);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  text-align: center;
  position: relative;
}
.bd-body-top {
  border-top: 1px solid var(--accent);
  padding-bottom: 0.25rem;
}
.bd-body-bot {
  border-bottom: 1px solid var(--accent);
  padding-top: 0.25rem;
}

/* dividing line between the two halves */
.bd-body-top::after {
  content: '';
  position: absolute;
  bottom: 0; left: 10%; right: 10%;
  height: 1px;
  background: color-mix(in srgb, var(--accent) 30%, transparent);
}

/* orientation notch */
.bd-notch {
  position: absolute;
  top: -1px; left: -1px;
  width: 0.65rem; height: 0.65rem;
  background: var(--background-lt);
  clip-path: polygon(0 0, 100% 0, 0 100%);
  border-right: 1px solid var(--accent);
  border-bottom: 1px solid var(--accent);
}

.bd-id {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: var(--accent);
}
.bd-sys {
  font-size: 0.52rem;
  letter-spacing: 0.18em;
  opacity: 0.45;
  text-transform: uppercase;
}
.bd-meta {
  display: flex;
  gap: 0.5rem;
  font-size: 0.52rem;
  letter-spacing: 0.1em;
  opacity: 0.55;
}
.bd-active { color: #4ade80; opacity: 1; }

/* ── Pins ─────────────────────────────────────────────────── */
.bd-pin {
  display: flex;
  align-items: center;
  align-self: center;
}
.bd-l { justify-self: end; }
.bd-r { justify-self: start; }

.bd-wire {
  flex-shrink: 0;
  width: 1.25rem;
  height: 1px;
  background: color-mix(in srgb, var(--accent) 60%, transparent);
}

.bd-pin-label {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  text-align: right;
  padding-right: 0.35rem;
}
.bd-pin-label-r {
  text-align: left;
  padding-right: 0;
  padding-left: 0.35rem;
}

.bd-ref {
  font-size: 0.55rem;
  color: var(--accent);
  opacity: 0.65;
  letter-spacing: 0.1em;
}
.bd-name {
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.07em;
  color: var(--accent);
  white-space: nowrap;
}
.bd-desc {
  font-size: 0.58rem;
  opacity: 0.55;
  line-height: 1.3;
}

/* ── Mobile ──────────────────────────────────────────────── */
@media (max-width: 520px) {
  .bd {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto auto auto;
  }
  .bd-pin.bd-l:first-child  { grid-column: 1; grid-row: 1; justify-self: start; }
  .bd-pin.bd-r:nth-child(3) { grid-column: 2; grid-row: 1; justify-self: end; }
  .bd-body-top { grid-column: 1; grid-row: 2; border-right: none; }
  .bd-body-bot { grid-column: 2; grid-row: 2; border-left: none; border-top: 1px solid var(--accent); }
  .bd-body-top::after { display: none; }
  .bd-pin.bd-l:nth-child(4) { grid-column: 1; grid-row: 3; justify-self: start; }
  .bd-pin.bd-r:last-child   { grid-column: 2; grid-row: 3; justify-self: end; }
  .bd-wire { display: none; }
  .bd-pin { flex-direction: column; align-items: flex-start; }
  .bd-r.bd-pin { align-items: flex-end; }
  .bd-pin-label, .bd-pin-label-r { text-align: left; padding: 0.15rem 0; }
  .bd-pin-label-r { text-align: right; }
}
</style>
