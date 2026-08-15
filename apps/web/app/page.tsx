import { ChatPanel } from "@/components/ChatPanel";
import { ProjectsPanel } from "@/components/ProjectsPanel";
import { TasksPanel } from "@/components/TasksPanel";
import { AgentsPanel } from "@/components/AgentsPanel";
import { ActivityPanel } from "@/components/ActivityPanel";
import { SystemStatusPanel } from "@/components/SystemStatusPanel";
import { RemindersPanel } from "@/components/RemindersPanel";
import { PermissionsBanner } from "@/components/PermissionsBanner";
import { JarvisHero } from "@/components/JarvisHero";
import { Card } from "@/components/ui/Card";

export default function DashboardPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PermissionsBanner />

      <JarvisHero />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="JARVIS · Chat" className="lg:col-span-2 flex h-[560px] flex-col">
          <div className="min-h-0 flex-1">
            <ChatPanel />
          </div>
        </Card>

        <div className="flex flex-col gap-6">
          <SystemStatusPanel />
          <AgentsPanel />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <ProjectsPanel />
        <TasksPanel />
        <ActivityPanel />
        <RemindersPanel />
      </div>
    </div>
  );
}
