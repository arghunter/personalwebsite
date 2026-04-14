---
title: "KERNN v1 - Building A General Feed Forward Neural Network Accelerator"
description: "How I built a general purpose feed forward neural network accelerator"
longDescription: ""
date: 2026-4-10
hidden: false
---
# KERNN v1 - Building A General Deep Neural Network Accelerator

AI, something we can't seem to escape from. It feels like wherever I go, I can't escape from yet another company touting their new AI application. Admittedly, some of these are pretty cool though. As a hardware person, I've honestly ignored AI for the most part, instead building hearing aids and signal processing accelerators. 

However, over winter break, I had the opportunity to explore GPU architecture and write CUDA/ROCM kernals, and I gained an appreciatation for the low level hardware behind AI, so I figured I'd build a neural network accelerator myself.

## What does it do?

What does it mean to accelerate a Feed Forward Neural Network? It means doing matrix multiplication, really really fast. Now, there are some other operations but those are far less computationally complex. Beyond that, there isn't really much more computational work. 

## How does it work?

<ManimAnimation src="/animations/systolic-array-v2.mp4" caption="Data flow through a 3×3 systolic array — A rows pulse right (violet), B columns pulse down (cyan), PEs fire along the diagonal" :autoplay="true" :loop="true" />

The core of the design is a systolic array, which performs the matrix multiplication. All of the other hardware is either for control flow, or helps feed a systolic array. A systolic array lets you perform matrix multiplication in a way that reduces memory bandwidth requirements and maximizes data reuse. Data pulses through it in a massive 2D pipeline. This results in letting you do an N * N matrix multiplication in O(N) time rather than in O(N^2) time.

So, to compute a N * N matrix, we need a N * N systolic array. Well that would be ideal, but on a chip multiplier are large and expensive, plus we are physically constrained by space. So, we need a way to run a matrix that is larger than N*N. This is where tiling comes in.

Lets say we have an N * N matrix multiplication, but a systolic array of size of M * M, what we instead have to do is

<ManimAnimation src="/animations/tiling.mp4" caption="A 4×4 matrix multiply tiled onto a 2×2 systolic array — each tile pair flows through the array and accumulates into the output" :autoplay="true" :loop="true" />

## WIP, Tested and Functional, but Midterms are taking all my time :(