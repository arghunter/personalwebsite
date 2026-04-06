---
title: "Supermic+more: PDM Bitstream ASICs for Audio Signal Processing"
description: "Eight signal processing ASICs fabricated on the Skywater 130nm CMOS process via Tiny Tapeout 8, targeting beamforming and audio DSP for hearing aids."
longDescription: "PDM microphones have remarkable properties for beamforming. By manipulating the bitstream directly at 3072 kHz rather than converting to PCM first, delay-and-sum beamforming becomes simpler and more precise. This project implements these operations as ASICs using the Skywater 130nm CMOS process, with eight designs submitted for fabrication."
date: 2024-9-1
---

# Supermic+more: PDM Bitstream ASICs to Accelerate Audio Signal Processing

## Summary

PDM microphones are commonly used in cellphones, and most microprocessors include hardware support to convert the PDM bitstreams into standard PCM format, typically supporting two channels. While it is possible to source specialized hardware to support more channels and convert PDM to PCM, native PDM bitstreams have remarkable properties that benefit beamforming (and other signal processing) applications.

Compared to PCM, directly manipulating the PDM bitstream offers significant advantages for beamforming. PCM is typically sampled at 48 kHz, requiring complex fractional delay techniques for effective beamforming. In contrast, the PDM bitstream operates at a 3072 kHz rate, providing much higher time resolution, which makes delay implementation simpler and more precise, allowing for better beamforming performance and efficiency.

Similarly, other operations like cross-correlation, pitch detection, and null steering can be applied directly to the PDM bitstream. Since these operations are typically 1-bit wide but occur at much higher rates than audio frequencies, they are best implemented in silicon rather than through software.

This project implements these operations as ASICs using the Skywater 130nm CMOS process. Eight designs of subsystems useful for hearing aids were submitted for fabrication in September 2024 via Tiny Tapeout 8.

## Individual Chips

- **SuperMic** — An 8-microphone delay-and-sum beamformer with programmable delays and a 3rd-order CIC filter for PDM-to-PCM conversion. Includes I2S output for Raspberry Pi. Implemented in Verilog, taped out on TT08 (8x2 slices). [GDSII](https://arghunter.github.io/Supermic-tt08/) · [Docs](https://github.com/arghunter/Supermic-tt08/blob/main/docs/info.md)

- **16-Microphone Beamformer** — 16-channel PDM beamformer with DDR input, SDR conversion, 3-stage CIC filter, and I2S output. [GDSII](https://arghunter.github.io/16-Mic-Beamformer-Verilog/) · [Docs](https://github.com/arghunter/16-Mic-Beamformer-Verilog/blob/main/docs/info.md)

- **Programmable PDM Pitch Filter** — Narrowband notch filter exploiting PDM time resolution to remove a specific frequency from an audio stream. 1x2 slices. [GDSII](https://arghunter.github.io/Customizable-PDM-Pitch-Filter-ASIC/) · [Docs](https://github.com/arghunter/Customizable-PDM-Pitch-Filter-ASIC/blob/main/docs/info.md)

- **Programmable PDM Cross and Auto Correlator** — Computes delay via the correlation operator; useful for direction-of-arrival estimation and pitch identification. 1x2 slices. [GDSII](https://arghunter.github.io/Customizable-PDM-Cross-Correlator-ASIC/) · [Docs](https://github.com/arghunter/Customizable-PDM-Cross-Correlator-ASIC/blob/main/docs/info.md)

- **Digital to Digital Converter (two channel)** — Converts 16-bit stereo PCM to a 64x oversampled PDM bitstream. 2x2 slices. [GDSII](https://arghunter.github.io/DDC-Digital-to-DIgital-Converter/) · [Docs](https://github.com/arghunter/DDC-Digital-to-DIgital-Converter/blob/main/docs/info.md)

- **I2S to PWM Converter** — Converts I2S to PWM for analog output via a simple low-pass filter. 1x1 slices. [GDSII](https://arghunter.github.io/I2S-to-PWM-Verilog/) · [Docs](https://github.com/arghunter/I2S-to-PWM-Verilog/blob/main/docs/info.md)

- **Dual Mixer Time Difference Converter** — Measures similarity between two PDM bitstreams with a programmable 128-bit delay for path compensation. 1x1 slices. [GDSII](https://arghunter.github.io/DMTD-Verilog/) · [Docs](https://github.com/arghunter/DMTD-Verilog/blob/main/docs/info.md)

- **Clock Divider** — 7-bit programmable divider with variable delay shift for alignment. 1x1 slices. [GDSII](https://arghunter.github.io/Clock-Divider-Verilog/) · [Docs](https://github.com/arghunter/Clock-Divider-Verilog/blob/main/docs/info.md)

## More Coming Soon...

None of this would have been possible without the amazing instructors, TAs, and people at BWSI and MIT Lincoln Labs.
