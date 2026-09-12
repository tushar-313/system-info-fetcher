# VC_02: The Succession Plan

## THE SYSINFO SELECTION RITUAL: BATCH OF 2027
Architect: user4 (First Year, B.Tech)

Tonight is not an interview. It is a test of whether someone can stay calm when the machine gets stubborn.

To find the next Ghost in the Machine, I would not start with CGPA or a polished resume. I would look for grit, technical intuition, and the ability to pivot when the system says no.

## Phase 1: The Keep-Alive Test
The candidate gets an SSH login to a container that has been rigged with a cron job. Every 60 seconds, anything that is not root gets killed.

The goal is simple: write a background script, a loop, or whatever survives long enough to keep the service alive before the judges check the port.

What it proves: persistence. Can they keep uptime under hostile conditions without panicking?

## Phase 2: The Legacy Fallback
The candidate is told to deploy a modern web app, but the server is running an old version of Node.js, so the newest libraries fail immediately.

The goal is to diagnose the MODULE_NOT_FOUND error, recognize that the problem is environmental, and manually research a compatible legacy stack, even if that means using something like Express 4.17.1 instead of whatever is trending.

What it proves: debugging depth. Do they understand the reason behind the error, or do they only know how to copy a fix from the internet?

## Phase 3: The Visionary's Mirror
The candidate finds a folder full of the letters and roadmaps I left behind in 2026. Their final task is to refactor the past: find one inefficiency in the dashboard I built, improve it, and then write their own letter to the freshman of 2041.

The goal is to improve the interactive routing or the UI of this dashboard, but the real test is whether they can improve something that already exists without breaking it.

What it proves: humility, taste, and the courage to improve upon their predecessors.

## The Selection Criterion
I will not choose the one who finishes first.

I will choose the one who, when the server crashed at midnight, did not ask "What do I do?" but instead sent me a log file explaining exactly why it broke and how they bypassed it.

We don't follow the curriculum. We pick the locks.
