---
title: "KERNN v1 - Building A General Feed Forward Neural Network Accelerator"
description: "How I built a general purpose feed forward neural network accelerator"
longDescription: ""
date: 2026-4-10
---

# KERNN v1 - Building A General Deep Neural Network Accelerator

AI, something we can't seem to escape from. It feels like wherever I go, I can't escape from yet another company touting their new AI application. Admittedly, some of these are pretty cool though. As a hardware person, I've honestly ignored AI for the most part, instead building hearing aids and signal processing accelerators. 

However, over winter break, I had the opportunity to explore GPU architecture and write CUDA/ROC-M kernals, and I gained an appreciatation for the low level hardware behind AI, so I figured I'd build a neural network accelerator myself.

## What does it do?

What does it mean to accelerate a Feed Forward Neural Network? It means doing matrix multiplication, really really fast. Now, there are some other operations but those are far less computationally complex. Beyond that, there isn't really much more computational work. 

## How does it work?

The core of the design is a systolic array, which performs the matrix multiplication. All of the other hardware is either for control flow, or helps feed a systolic array.


# WORK IN PROGESS, mb.