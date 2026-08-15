import { getOrCreateDefaultUser } from "./repositories/users.js";
import { createProject } from "./repositories/projects.js";
import { createTask } from "./repositories/tasks.js";
import { saveMemory } from "./repositories/memories.js";

async function seed() {
  const user = await getOrCreateDefaultUser("owner@local", "Owner");
  console.log("Seeded user:", user.id);

  const project = await createProject({
    userId: user.id,
    name: "Welcome to JARVIS",
    description: "A starter project created automatically on first run.",
    goal: "Explore what JARVIS can do: chat, tasks, agents, memory.",
  });
  console.log("Seeded project:", project.id);

  await createTask({
    projectId: project.id,
    description: "Say hello to JARVIS in the chat panel.",
    priority: "LOW",
  });

  await saveMemory({
    userId: user.id,
    type: "USER_PREFERENCE",
    content: "The user wants JARVIS to be direct, concise, and proactive.",
    importance: 0.8,
  });

  console.log("Seed complete.");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
