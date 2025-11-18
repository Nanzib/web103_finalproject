# Milestone 4

This document should be completed and submitted during **Unit 8** of this course. You **must** check off all completed tasks in this document in order to receive credit for your work.

## Checklist

This unit, be sure to complete all tasks listed below. To complete a task, place an `x` between the brackets.

- [X] Update the completion percentage of each GitHub Milestone. The milestone for this unit (Milestone 4 - Unit 8) should be 100% completed when you submit for full points.
- [X] In `readme.md`, check off the features you have completed in this unit by adding a ✅ emoji in front of the feature's name.
  - [X] Under each feature you have completed, include a GIF showing feature functionality.
- [X] In this document, complete all five questions in the **Reflection** section below.

## Reflection

### 1. What went well during this unit?

Team communication was effective. We were able to divide the project's core, complex features (like the API integration and real-time multiplayer) among different team members, which allowed us to work in parallel without major merge conflicts.

### 2. What were some challenges your group faced in this unit?

A major challenge was discovering that a key part of an external API we rely on (for the audio clips) was deprecated. This forced us to spend a lot of unplanned time researching and implementing a fallback solution, which set our schedule back.

### Did you finish all of your tasks in your sprint plan for this week? If you did not finish all of the planned tasks, how would you prioritize the remaining tasks on your list?

We didn't complete all our planned tasks, mostly due to the unexpected API problem. Our priority now is to get the "must-have" features (the core daily game loop and multiplayer) fully functional. We've moved lower-priority features, like detailed user profiles or advanced sharing options, to the next sprint.

### Which features and user stories would you consider “at risk”? How will you change your plan if those items remain “at risk”?

The Live Multiplayer Sessions feature is the most "at-risk" because it's the most complex. It requires the backend, the API, and the real-time (WebSocket) components to all work together perfectly. If we can't get the real-time aspect stable, our backup plan is to change it to a turn-based game, which would be much simpler to build.

### 5. What additional support will you need in upcoming units as you continue to work on your final project?

As we get closer to finishing, we'll need support or clear documentation on how to deploy a full-stack application with this many parts (React frontend, Express backend, database) to Render, especially making sure all environment variables and API keys are secure.
