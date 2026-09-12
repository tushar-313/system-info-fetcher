# CC_03: The Deep-Dive

## How I Hosted a Site on a "Locked" Server (And Why It Was a Pain)
By: user4

If you’re reading this, you probably know the feeling of a server telling you "Permission Denied" over and over. Tonight, I was given a restricted Ubuntu container and told to host a website. Here’s the story of how I fought the machine and won.

## 1. The Problem
I tried to be fancy. I tried to install Docker and Coolify to handle everything for me.
The System said: "No."
Because it’s a restricted container, I didn't have the kernel permissions to run Docker. I couldn't even start a basic background service using systemctl. I was stuck in a box with no tools.

## 2. The Pivot
Instead of complaining, I went back to basics. I realized I didn't need a massive deployment tool; I just needed Node.js.

I wrote a simple script using a library called Express.

I pointed it to Port 8000.

I used the server's internal IP to bridge the connection to the outside world.

## 3. The "Node Version" Trap
Even then, it broke. I installed the latest version of Express, but the server was running an old version of Node. It gave me a weird error about node:events.
The Fix: I had to force the server to install an older, "Legacy" version of Express (v4.17.1). Suddenly, everything clicked.

## 4. Making it "Professional" (The GitHub Bridge)
Typing code directly into a terminal is slow and risky. One wrong command and you lose everything.

I moved all my code to GitHub.

I set up a "Sync" where I code comfortably on my Mac and just "Pull" the changes to the server.

This means if the server ever wipes my files, I can bring them back in 5 seconds.

## The Lesson
Being a developer isn't about knowing the fanciest tools. It’s about knowing how to work when those tools are taken away. If the front door is locked, find a window. If the window is locked, pick the lock.
