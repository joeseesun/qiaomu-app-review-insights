'use client';

import { ArrowUpRight, Gift, Github, MessageCircle, QrCode, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const profileLinks = [
  { label: '乔木推荐', href: 'https://tuijian.qiaomu.ai/', highlight: true },
  { label: '个人站', href: 'https://qiaomu.ai' },
  { label: '博客', href: 'https://blog.qiaomu.ai' },
  { label: 'GitHub', href: 'https://github.com/joeseesun/' },
  { label: 'X', href: 'https://x.com/vista8' },
];

export function SiteAffordances({ subtle = false }: { subtle?: boolean }) {
  const buttonClass = subtle
    ? 'grid h-9 w-9 place-items-center rounded-md border border-zinc-200 bg-white text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900/15'
    : 'grid h-10 w-10 place-items-center rounded-md border border-zinc-200 bg-white text-zinc-600 transition hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900/15';

  return (
    <div className="flex items-center gap-2">
      <Dialog>
        <DialogTrigger asChild>
          <button type="button" title="打赏支持" aria-label="打赏支持" className={buttonClass}>
            <Gift className="h-4 w-4" />
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-sm rounded-lg border-zinc-200 bg-white">
          <DialogHeader>
            <DialogTitle>打赏支持</DialogTitle>
            <DialogDescription>谢谢支持向阳乔木继续打磨实用 AI 工具。</DialogDescription>
          </DialogHeader>
          <img
            src="/qiaomu/reward.png"
            alt="打赏二维码"
            className="mx-auto max-h-[62vh] w-full max-w-[260px] rounded-lg border border-zinc-200 object-contain"
          />
        </DialogContent>
      </Dialog>

      <Dialog>
        <DialogTrigger asChild>
          <button type="button" title="关注向阳乔木" aria-label="关注向阳乔木" className={buttonClass}>
            <QrCode className="h-4 w-4" />
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-sm rounded-lg border-zinc-200 bg-white">
          <DialogHeader>
            <DialogTitle>关注向阳乔木</DialogTitle>
            <DialogDescription>微信公众号：向阳乔木推荐看</DialogDescription>
          </DialogHeader>
          <img
            src="/qiaomu/wechat.jpg"
            alt="向阳乔木推荐看二维码"
            className="mx-auto max-h-[54vh] w-full max-w-[260px] rounded-lg border border-zinc-200 object-contain"
          />
          <div className="flex flex-wrap justify-center gap-2">
            <a
              href="https://github.com/joeseesun/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-950"
            >
              <Github className="h-4 w-4" />
              GitHub
            </a>
            <a
              href="https://x.com/vista8"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-950"
            >
              <MessageCircle className="h-4 w-4" />
              X
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-zinc-200 bg-[#fdfdfb]">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] lg:px-8">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="乔木App评价洞察 Logo" className="h-10 w-10 rounded-lg shadow-sm" />
            <div>
              <p className="text-sm font-semibold text-zinc-950">乔木App评价洞察</p>
              <p className="text-xs text-zinc-500">向阳乔木的 App Store 评论洞察工具</p>
            </div>
          </div>
          <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-600">
            向阳乔木把 AI 前沿变化转译成产品判断、可执行工作流、AI coding 实践和 GEO/AI 营销方法论。
          </p>
        </div>

        <nav aria-label="乔木站点链接" className="min-w-0">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-teal-700">
            <Sparkles className="h-4 w-4" />
            Qiaomu Network
          </div>
          <div className="flex flex-wrap gap-2">
            {profileLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm transition ${
                  link.highlight
                    ? 'border-teal-200 bg-teal-50 text-teal-700 hover:border-teal-300 hover:text-teal-900'
                    : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-950'
                }`}
              >
                {link.label}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            ))}
          </div>
        </nav>

        <div className="flex flex-col gap-3 lg:items-end">
          <SiteAffordances />
          <p className="text-xs leading-6 text-zinc-500">
            © {new Date().getFullYear()} 向阳乔木
          </p>
        </div>
      </div>
    </footer>
  );
}
