import { useState } from "react";
import { motion } from "motion/react";
import { Github, Linkedin, Mail, Twitter, Code2, Heart, Coffee, Sparkles, MessageSquare, ShieldCheck, Cpu, Zap, Layers } from "lucide-react";
import deepakRealImg from "../assets/deepak_real.webp";

export default function AboutUs({ onFeedbackClick }) {
  const team = [
    {
      name: "Deepak Prajapati",
      role: "Lead Developer & Founder",
      bio: "Passionate about building high-performance web applications and document processing tools. Leading the vision for PageDocx to make document management accessible to everyone.",
      image: deepakRealImg,
      socials: { github: "https://github.com/deepak8186863620", linkedin: "https://www.linkedin.com/in/deepak-prajapati-819b81327/", twitter: "#", email: "deepakprajapatid021@gmail.com" }
    }
  ];

  return (
    <div className="pt-32 pb-20 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full text-sm font-bold text-white mb-8 uppercase tracking-widest"
          >
            <Code2 size={16} />
            <span>Behind the Scenes</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-6xl md:text-8xl font-black tracking-tighter text-white mb-8 leading-[0.9]"
          >
            WE BUILD TOOLS <br />
            <span
              className="text-transparent bg-clip-text"
              style={{ backgroundImage: "linear-gradient(to right, var(--text-primary), var(--text-secondary), var(--text-muted))" }}
            >
              FOR THE FUTURE
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-zinc-400 text-xl max-w-2xl mx-auto leading-relaxed"
          >
            PageDocx by Deepak Prajapati was born out of a simple need: making complex document tasks
            fast, secure, and incredibly easy. We're a small team with a big vision.
          </motion.p>
        </div>

        {/* Our Story Section */}
        <div className="mb-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-zinc-900/40 backdrop-blur-3xl border border-white/5 p-10 md:p-16 rounded-[40px] max-w-5xl mx-auto text-center"
          >
            <h2 className="text-3xl md:text-5xl font-black text-white mb-8 tracking-tight">The PageDocX Story</h2>
            <div className="space-y-6 text-zinc-400 text-lg md:text-xl leading-relaxed font-medium">
              <p>
                In today's fast-paced digital world, managing documents shouldn't be a bottleneck. PageDocX was created to bridge the gap between traditional PDF tools and next-generation AI capabilities. 
              </p>
              <p>
                We noticed that professionals were constantly switching between multiple apps to sign, merge, compress, and analyze their PDFs. Our vision was to unify these features into a single, high-performance platform that doesn't compromise on privacy or speed.
              </p>
              <p>
                Today, PageDocX serves as a comprehensive document workspace, empowering users to not just edit their files, but truly understand them through advanced AI chat, smart OCR, and intelligent summarization.
              </p>
            </div>
          </motion.div>
        </div>

        {/* Developer Section */}
        <div className="space-y-32 mb-32">
          {team.map((member, idx) => {
            const isEven = idx % 2 === 0;
            return (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                {/* Image Column */}
                <motion.div
                  initial={{ opacity: 0, x: isEven ? -50 : 50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className={`relative group w-full max-w-[360px] mx-auto ${isEven ? "md:order-1" : "md:order-2"}`}
                >
                  <div className="absolute -inset-4 bg-gradient-to-r from-white to-zinc-500 rounded-[40px] blur-2xl opacity-10 group-hover:opacity-20 transition-opacity duration-500" />
                  <div className="relative aspect-square rounded-[32px] overflow-hidden border border-zinc-800 bg-zinc-900">
                    <img
                      src={member.image}
                      alt={member.name}
                      className="w-full h-full object-cover transition-all duration-700 scale-110 group-hover:scale-100"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </motion.div>

                {/* Text Column */}
                <motion.div
                  initial={{ opacity: 0, x: isEven ? 50 : -50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className={`space-y-8 ${isEven ? "md:order-2" : "md:order-1"}`}
                >
                  <div>
                    <h2 className="text-4xl font-black text-white tracking-tight mb-2">{member.name}</h2>
                    <p className="text-zinc-400 font-bold uppercase tracking-widest text-sm">{member.role}</p>
                  </div>

                  <p className="text-zinc-400 text-lg leading-relaxed italic font-medium">
                    "{member.bio}"
                  </p>

                  <div className="flex items-center gap-4">
                    <a href={member.socials.github} className="w-12 h-12 rounded-2xl bg-[#161616] border border-[#2a2a2a] flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-600 transition-all">
                      <Github size={20} />
                    </a>
                    <a href={member.socials.linkedin} className="w-12 h-12 rounded-2xl bg-[#161616] border border-[#2a2a2a] flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-600 transition-all">
                      <Linkedin size={20} />
                    </a>
                    <a href={member.socials.twitter} className="w-12 h-12 rounded-2xl bg-[#161616] border border-[#2a2a2a] flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-600 transition-all">
                      <Twitter size={20} />
                    </a>
                    <a href={`mailto:${member.socials.email}`} className="w-12 h-12 rounded-2xl bg-[#161616] border border-[#2a2a2a] flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-600 transition-all">
                      <Mail size={20} />
                    </a>
                  </div>
                </motion.div>
              </div>
            );
          })}
        </div>

        {/* Core Capabilities */}
        <div className="mb-32 max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-6">Engineered for Performance</h2>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              A modern tech stack designed to handle complex document workflows securely and instantly.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Cpu,
                title: "AI-Powered Core",
                desc: "Integrated with advanced AI models to provide deep document analysis, chatting, and intelligent OCR extraction."
              },
              {
                icon: ShieldCheck,
                title: "Bank-Grade Security",
                desc: "Your data privacy is our priority. Files are processed securely over encrypted connections and automatically purged."
              },
              {
                icon: Zap,
                title: "Lightning Fast",
                desc: "Built on a robust Node.js backend and optimized React frontend, ensuring heavy PDF processing happens in milliseconds."
              },
              {
                icon: Layers,
                title: "All-in-One Suite",
                desc: "From basic splitting and merging to advanced E-Signatures and format conversions, everything you need is in one place."
              }
            ].map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="bg-black border border-white/10 p-8 rounded-[32px] hover:bg-[#111] transition-colors group"
              >
                <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-white mb-6 group-hover:scale-110 group-hover:bg-white group-hover:text-black transition-all duration-300">
                  <feature.icon size={24} />
                </div>
                <h3 className="text-xl font-bold text-white mb-3 tracking-tight">{feature.title}</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Mission / Values */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-32">
          {[
            {
              icon: Sparkles,
              title: "Innovation First",
              desc: "We constantly push the boundaries of what's possible in the browser, using the latest document and web technologies."
            },
            {
              icon: Heart,
              title: "User Centric",
              desc: "Every feature we build starts with a user problem. We prioritize simplicity and speed above all else."
            },
            {
              icon: Coffee,
              title: "Built with Passion",
              desc: "We love what we do. PageDocx is a labor of love, built with countless cups of coffee and dedication."
            }
          ].map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="p-8 bg-zinc-900/40 backdrop-blur-2xl border border-zinc-800/50 rounded-[32px] hover:border-zinc-700/50 transition-all group"
            >
              <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform duration-500">
                <item.icon size={28} />
              </div>
              <h3 className="text-xl font-black text-white mb-3 tracking-tight">{item.title}</h3>
              <p className="text-zinc-500 leading-relaxed font-medium">{item.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Contact CTA */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="p-12 bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 rounded-[48px] text-center relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 blur-[100px] rounded-full" />
          <div className="relative z-10">
            <h2 className="text-4xl font-black text-white mb-6 tracking-tight">Have a question or feedback?</h2>
            <p className="text-zinc-400 text-lg mb-10 max-w-xl mx-auto">
              We're always looking to improve. Reach out to us if you have suggestions or just want to say hi!
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={onFeedbackClick}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-white text-black px-10 py-5 rounded-full font-black text-sm uppercase tracking-widest hover:scale-105 transition-all active:scale-95"
              >
                <MessageSquare size={20} />
                Rate our App
              </button>
              <a
                href={`mailto:${team[0].socials.email}`}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-zinc-900 text-white border border-zinc-800 px-10 py-5 rounded-full font-black text-sm uppercase tracking-widest hover:bg-zinc-800 transition-all active:scale-95"
              >
                <Mail size={20} />
                Get in Touch
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
