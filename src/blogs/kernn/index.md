---
title: "KERNN v1 - Building A Feed Forward Neural Network Accelerator"
description: "How I built a general purpose feed forward neural network accelerator"
longDescription: ""
date: 2026-4-15
hidden: false
---
# KERNN v1 - Building A General Deep Neural Network Accelerator

AI, something we can't seem to escape from. It feels like wherever I go, I can't escape from yet another company touting their new AI application. Admittedly, some of these are pretty cool though. As a hardware person, I've honestly ignored AI for the most part, instead building hearing aids and signal processing accelerators. 

However, over winter break, I had the opportunity to explore GPU architecture and write CUDA/ROCM kernals, and I gained an appreciatation for the low level hardware behind AI, so I figured I'd build a neural network accelerator myself.

## What does it do?

What does it mean to accelerate a Feed Forward Neural Network? It means doing matrix multiplication, really really fast. Now, there are some other operations but those are far less computationally complex. Beyond that, there isn't really much more computational work. 

## How does it work?

In short, data flows from the host, through on-chip memory, through the systolic array, through the activation function, into a ping pong buffer, through a loop back, and eventually sends the result to host. Admittedly, thats not a very clear picture so let me go into a bit more depth. The following explaination will still remain somewhat high level, but there is a full depth explaination(array design,memory handling, state machine logic, etc.) at the end for those interested.

### The Core

The core of the design is a `Systolic Array`, which performs the matrix multiplication. All of the other hardware is either for control flow, or helps feed a systolic array. A systolic array lets you perform matrix multiplication in a way that reduces memory bandwidth requirements and maximizes data reuse. Data pulses through it in a massive 2D pipeline. Every cell in the array performs a `multiply and add (MAC)` operation every cycle This results in letting you do an N * N matrix multiplication in `O(N)` time rather than in `O(N^2)` time.

<ManimAnimation src="/animations/systolic-array-v2.mp4" caption="Data flow through a 3×3 systolic array — A rows pulse right (violet), B columns pulse down (cyan), PEs fire along the diagonal" :autoplay="true" :loop="true" />

So, to compute a N * N matrix, we need a N * N systolic array. Well that would be ideal, but on a chip multiplier are large and expensive, plus we are physically constrained by space. So, we need a way to run a matrix that is larger than N*N. This is where tiling comes in.

<ManimAnimation src="/animations/tiling.mp4" caption="A 4×4 matrix multiply tiled onto a 2×2 systolic array — each tile pair flows through the array and accumulates into the output" :autoplay="true" :loop="true" />

Lets say we have an N * N matrix multiplication, but a systolic array of size of M * M, what we instead have to do is take an M * M subsection of each matrix and find the partial product, then tile across the matrices, and sum the partials to get the final output.

### The Rest

Now that we can do an arbitrary matrix multiplication, we need to find a way to actually run a layer of a neural network on it. This is where the Layer Sequencer comes in. When the host loads a model, it configures the sequencer with the model details. This tells the sequencer how the model works, what matrices it needs to multiply and what activation functions to apply. When the activation data is loaded, the sequencer recieves a go signal and runs the entire computation. In between layers, the activation data ping pongs between two buffers so that we don't overwrite the data we are operating on. 

This is great, but we still need a way to tell the accelerator what to do. This is where the CommandParser comes into play. It opens a UART port from the FPGA to the host PC and listens for specific sequences for configuration, execution, reset, and more. To be honest, while this part is neither all that complex nor super interesting, I spent way too long debugging the I/O from the LayerSequencer to the CommandParser. There were many off by a cycle errors. 

When you put all of this together, we get a full fledged feed forward neural network accelerator. 

## How It's Made

So a little while ago, I had an idea for a clean way to architect a neural network accelerator in a parameterizable way that lets me easily scale to larger designs with simple memory bank configuration. Then, over the past few days, I implemented the architecture. All of the code is written in Chisel and the FPGA Deployment is done through Vivado. The FPGA used is an Alchitry Au+  that my [friend](https://unnamed.website/) lent to me and the [MIT OCL](https://web.mit.edu/ajzd/www/opencompute/). 

## Whats Next?

SPEEEEEEEEEEEEEDDDD! Right now, the design is comedically unoptimized. I can pretty easily name ways to make it about 64x faster. But, beyond speed, I also need to implement a proper cache and DDR3 data storage so that I can load large models on the accelerator. After that, I want to both try out different architectures and port more types of models. I recently read a paper on memory local computing with many tiles, and I'm thinking of creating a sort of Coarse Grained Reconfigurable Array. In that design, each of these would be one *kernnal* of the accelator. I also need to build on the design so that I can run CNNs, transformers, and more. 

## Demo

<video src="/IMG_8620.mov" controls style="width:100%;border-radius:8px;" />


<AMA />



## In Depth Explanation in Progess

All text of this blog is human produced. The animations are produced from manin scripts written by Claude.