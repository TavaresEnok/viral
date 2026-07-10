'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { capture } from '@/lib/analytics';
import type { Project } from '@/types/api.types';
import { listItem, stagger } from '@/lib/motion-variants';
import { ProjectCard } from './ProjectCard';

function NewVideoCard() {
  return (
    <Link
      href="/dashboard/new"
      onClick={() => capture('dashboard_new_project_clicked', { placement: 'dashboard_grid' })}
      className="flex min-h-[280px] flex-col items-center justify-center gap-4 rounded-card border-[1.5px] border-dashed border-hairline-strong bg-transparent p-6 text-center transition duration-200 ease-smooth hover:-translate-y-0.5 hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span className="grid h-[52px] w-[52px] place-items-center rounded-pill bg-accent text-[#10120A]">
        <Plus className="h-6 w-6" strokeWidth={2.4} />
      </span>
      <span className="font-display text-base font-bold tracking-tight text-ink-primary">Mandar vídeo novo</span>
      <span className="-mt-2 text-xs text-ink-tertiary">link do YouTube ou upload</span>
    </Link>
  );
}

export function ProjectGrid({ projects }: { projects: Project[] }) {
  return (
    <motion.div
      className="grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-[18px]"
      variants={stagger}
      initial="initial"
      animate="animate"
    >
      <motion.div variants={listItem}>
        <NewVideoCard />
      </motion.div>
      {projects.map((project) => (
        <motion.div key={project.id} variants={listItem}>
          <ProjectCard project={project} />
        </motion.div>
      ))}
    </motion.div>
  );
}
