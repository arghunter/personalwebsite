<script setup>
import { ref, computed } from 'vue'

const VALS = [0, 0.5, 1, 1.5, 2, 3, 4, 6, 0, -0.5, -1, -1.5, -2, -3, -4, -6]
const BITS = ['0000','0001','0010','0011','0100','0101','0110','0111',
              '1000','1001','1010','1011','1100','1101','1110','1111']
const DISP = ['0','0.5','1','1.5','2','3','4','6','−0','−0.5','−1','−1.5','−2','−3','−4','−6']

function mul(ai, bi) {
  const v = VALS[ai] * VALS[bi]
  return Object.is(v, -0) ? 0 : v
}

const selA = ref(6)  // default: 4
const selB = ref(6)  // default: 4

function qi9(val) {
  const n = Math.round(val * 4)
  const u = ((n % 512) + 512) % 512
  return u.toString(2).padStart(9, '0')
}

const selResult = computed(() => mul(selA.value, selB.value))
const qi9bits   = computed(() => qi9(selResult.value))
</script>

<template>
  <div class="fw">

    <!-- Header -->
    <div class="fw-head">
      <span class="fw-title">FP4 MULTIPLIER</span>
      <span class="fw-sub">E2M1 FORMAT · QI9 OUTPUT</span>
    </div>

    <!-- Calculator row -->
    <div class="fw-calc">
      <div class="fw-operand">
        <span class="fw-lbl">A</span>
        <select v-model="selA" class="fw-sel">
          <option v-for="(_, i) in VALS" :key="i" :value="i">
            {{ BITS[i] }}  ({{ DISP[i] }})
          </option>
        </select>
      </div>
      <span class="fw-op">×</span>
      <div class="fw-operand">
        <span class="fw-lbl">B</span>
        <select v-model="selB" class="fw-sel">
          <option v-for="(_, i) in VALS" :key="i" :value="i">
            {{ BITS[i] }}  ({{ DISP[i] }})
          </option>
        </select>
      </div>
      <span class="fw-op">=</span>
      <div class="fw-result">
        <span class="fw-result-val">{{ selResult }}</span>
        <div class="fw-qi9">
          <span
            v-for="(bit, k) in qi9bits" :key="k"
            class="fw-bit"
            :class="{ 'fw-bit-on': bit === '1', 'fw-bit-sep': k === 0 || k === 7 }"
          >{{ bit }}</span>
          <span class="fw-qi9-label">QI9</span>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.fw {
  font-family: 'DM Mono', monospace;
  margin: 2rem 0;
  border: 1px solid var(--hr-color);
  border-left: 3px solid var(--accent);
  background: color-mix(in srgb, var(--detail-lt) 60%, transparent);
}

/* ── Header ──────────────────────────────────────────────── */
.fw-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--hr-color);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}
.fw-title {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: var(--accent);
}
.fw-sub {
  font-size: 0.52rem;
  letter-spacing: 0.1em;
  opacity: 0.35;
}

/* ── Calculator ──────────────────────────────────────────── */
.fw-calc {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.8rem 1rem;
  flex-wrap: wrap;
}
.fw-operand {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.fw-lbl {
  font-size: 0.55rem;
  letter-spacing: 0.1em;
  opacity: 0.4;
}
.fw-sel {
  font-family: 'DM Mono', monospace;
  font-size: 0.7rem;
  background: var(--detail-lt);
  color: var(--primary-lt);
  border: 1px solid var(--hr-color);
  padding: 0.2rem 0.5rem;
  cursor: pointer;
  min-width: 8.5rem;
  border-radius: 0;
}
.fw-sel:focus { outline: 1px solid var(--accent); }
.fw-op {
  font-size: 1rem;
  color: var(--accent);
  opacity: 0.6;
}
.fw-result {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-left: 0.25rem;
}
.fw-result-val {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--accent);
  line-height: 1;
  letter-spacing: -0.02em;
  min-width: 3rem;
}
.fw-qi9 {
  display: flex;
  align-items: center;
  gap: 1px;
}
.fw-bit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  height: 1rem;
  font-size: 0.6rem;
  border: 1px solid color-mix(in srgb, var(--hr-color) 70%, transparent);
  background: color-mix(in srgb, var(--background-lt) 60%, transparent);
  color: var(--primary-lt);
  opacity: 0.3;
  transition: background 150ms, opacity 150ms;
}
.fw-bit.fw-bit-on {
  background: color-mix(in srgb, var(--accent) 20%, transparent);
  color: var(--accent);
  opacity: 1;
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
}
.fw-bit.fw-bit-sep { margin-left: 3px; }
.fw-qi9-label {
  font-size: 0.48rem;
  letter-spacing: 0.1em;
  opacity: 0.3;
  margin-left: 0.3rem;
}

</style>
