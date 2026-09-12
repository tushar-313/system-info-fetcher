# VC_03: The Roadmap

## My Plan for the Next Year
By: user4

I don't want to just talk about "learning." Here is exactly what I’m going to build to make this server and this club better.

### 3 Months: The "Auto-Restart" Script
Right now, if this container reboots or the system kills my Node process, the dashboard goes down.

The Goal: I’m going to write a small script that runs every few minutes to check if my website is still alive. If it’s dead, the script will restart it automatically.

The Tech: Just some simple Bash and Cron jobs. I want 100% uptime without me having to manually check it.

### 6 Months: A Local File Hub for the Hostel
Our hostel internet can be really slow or go down sometimes.

The Goal: I want to turn a part of this server into a local "Mirror." It’ll be a place where we can host common libraries (like React or Bootstrap), Linux ISOs, or study notes so we can download them over the local LAN at high speed instead of wasting our daily data.

The Tech: A simple file server with a search bar.

### 1 Year: The "One-Command" Deployer
When I started tonight, I struggled with paths, Git, and Node versions. It took way too long.

The Goal: I want to build a tool for the next batch of freshmen. They should be able to type one command on their own laptop, and their code should automatically push to this server, install the right modules, and go live.

The Tech: A custom CLI tool. I want to make it so they can focus on coding, not fighting the terminal for three hours like I did.
