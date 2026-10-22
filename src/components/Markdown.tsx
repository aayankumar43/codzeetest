"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ content, streaming = false }: { content: string; streaming?: boolean }) {
  return (
    <div className={`text-[14px] leading-relaxed text-ink/95 ${streaming ? "caret" : ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-acc underline decoration-acc/40 underline-offset-2 hover:decoration-acc"
            >
              {children}
            </a>
          ),
          ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="pl-0.5">{children}</li>,
          h1: ({ children }) => (
            <h1 className="text-base font-semibold mt-4 mb-2 first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-[15px] font-semibold mt-4 mb-2 first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-[14px] font-semibold mt-3 mb-1.5 first:mt-0">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-[13px] font-semibold mt-3 mb-1 first:mt-0">{children}</h4>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-acc/40 pl-3 my-3 text-mut">{children}</blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-3 rounded-md border border-line">
              <table className="w-full text-[13px]">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="text-left px-3 py-2 bg-elev font-semibold border-b border-line">{children}</th>
          ),
          td: ({ children }) => <td className="px-3 py-1.5 border-b border-line/60">{children}</td>,
          pre: ({ children }) => (
            <pre className="bg-[#0a0d10] border border-line rounded-md p-3 my-3 overflow-x-auto font-mono text-[12.5px] leading-relaxed text-[#c9d4c0]">
              {children}
            </pre>
          ),
          code: ({ children, className }) => {
            const isBlock = /language-/.test(className ?? "");
            if (isBlock) return <code>{children}</code>;
            return (
              <code className="font-mono text-[12.5px] bg-elev border border-line/70 rounded px-1.5 py-0.5 text-acc">
                {children}
              </code>
            );
          },
          hr: () => <hr className="my-4 border-line" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
