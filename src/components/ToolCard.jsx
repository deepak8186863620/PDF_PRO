import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";

export default function ToolCard({ name, description, icon: Icon, color, category, onClick }) {
  return (
    <motion.button
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      onClick={onClick}
      className="group relative w-full text-left rounded-[16px] sm:rounded-[20px] p-4 sm:p-6 cursor-pointer overflow-hidden focus:outline-none focus-ring bg-[#111111] border border-[#2a2a2a] hover:bg-[#18181A] transition-colors duration-300"
    >
      {/* Subtle top border highlight on hover */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="relative z-10 flex flex-col h-full">
        {/* Top section: Icon and Badge */}
        <div className="flex items-start justify-between mb-3 sm:mb-5">
          <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center text-white ${color}`}>
            <Icon size={20} className="sm:w-6 sm:h-6 opacity-90" />
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="hidden sm:inline-block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 bg-white/5 border border-white/5 px-2.5 py-1 rounded-full">
              {category}
            </span>
            <div className="w-7 h-7 rounded-full bg-white/5 border border-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 text-zinc-400 group-hover:text-white">
              <ArrowUpRight size={14} />
            </div>
          </div>
        </div>

        {/* Text content */}
        <div className="space-y-1 sm:space-y-1.5 mb-6 sm:mb-8">
          <h3 className="text-[14px] sm:text-[16px] font-semibold text-white tracking-tight leading-tight sm:leading-normal">
            {name}
          </h3>
          <p className="hidden sm:block text-zinc-400 text-[12.5px] leading-relaxed line-clamp-2 pr-2">
            {description}
          </p>
          <p className="sm:hidden text-zinc-400 text-[11px] leading-snug line-clamp-2 pr-1">
            {description}
          </p>
        </div>

        {/* Bottom CTA */}
        <div className="mt-auto flex items-center justify-between">
          <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 group-hover:text-white transition-colors duration-300">
            Open Tool
          </span>
          <div className="w-5 h-[1.5px] bg-zinc-700 group-hover:w-10 group-hover:bg-white transition-all duration-300" />
        </div>
      </div>
    </motion.button>
  );
}
