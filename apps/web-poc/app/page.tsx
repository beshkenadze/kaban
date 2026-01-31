import { Button } from "@/components/ui/button";
import { ArrowRight, Database, Layout, Zap } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="container mx-auto px-4 py-16 max-w-5xl">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 text-indigo-400 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Zap className="w-4 h-4" />
            ZenStack v3 + Turso POC
          </div>
          
          <h1 className="text-5xl font-bold tracking-tight text-white mb-6">
            Kaban Board
          </h1>
          
          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-8">
            Modern Kanban board powered by ZenStack ORM and Turso database. 
            Built with Next.js 14, featuring real-time sync and offline-first architecture.
          </p>

          <div className="flex gap-4 justify-center">
            <Button 
              size="lg" 
              className="bg-indigo-600 hover:bg-indigo-700"
              asChild
            >
              <a href="/board/demo">
                Open Demo Board
                <ArrowRight className="ml-2 w-4 h-4" />
              </a>
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="border-slate-700"
            >
              View Documentation
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6">
            <div className="w-12 h-12 bg-indigo-500/20 rounded-lg flex items-center justify-center mb-4">
              <Database className="w-6 h-6 text-indigo-400" />
            </div>
            <h3 className="font-semibold text-white mb-2">Turso Database</h3>
            <p className="text-sm text-slate-400">
              Edge SQLite with embedded replica support for offline-first architecture
            </p>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-lg flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="font-semibold text-white mb-2">ZenStack v3</h3>
            <p className="text-sm text-slate-400">
              Type-safe ORM with automatic CRUD API and built-in access control
            </p>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6">
            <div className="w-12 h-12 bg-amber-500/20 rounded-lg flex items-center justify-center mb-4">
              <Layout className="w-6 h-6 text-amber-400" />
            </div>
            <h3 className="font-semibold text-white mb-2">Modern UI</h3>
            <p className="text-sm text-slate-400">
              Built with shadcn/ui components and Tailwind CSS for beautiful interface
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
