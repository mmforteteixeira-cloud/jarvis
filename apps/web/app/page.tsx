import { ChatPanel } from "@/components/ChatPanel";
import { ProjectsPanel } from "@/components/ProjectsPanel";
import { TasksPanel } from "@/components/TasksPanel";
import { AgentsPanel } from "@/components/AgentsPanel";
import { ActivityPanel } from "@/components/ActivityPanel";
import { SystemStatusPanel } from "@/components/SystemStatusPanel";
import { PermissionsBanner } from "@/components/PermissionsBanner";
import { Card } from "@/components/ui/Card";

export default function DashboardPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PermissionsBanner />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="JARVIS · Chat" className="lg:col-span-2 h-[520px] flex flex-col">
          <div className="flex-1 min-h-0">
            <ChatPanel />
          </div>
        </Card>

        <div className="flex flex-col gap-6">
          <SystemStatusPanel />
          <AgentsPanel />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ProjectsPanel />
        <TasksPanel />
        <ActivityPanel />
      </div>
    </div>
  );
}
