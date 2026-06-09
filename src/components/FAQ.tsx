import React from 'react';
import { ChevronDown } from 'lucide-react';

const faqItems = [
  { q: "What is BoldShare?", a: "BoldShare is a privacy-first platform for temporary data sharing. Create formatted text snippets or upload files that exist only as long as you want them to." },
  { q: "How long do links remain available?", a: "You decide! Set expiry from 15 minutes up to 24 hours. After that, they are gone forever." },
  { q: "Is it secure?", a: "Absolutely. We don't track who you are. Content is automatically deleted from our servers the moment it expires." },
  { q: "What's the maximum file size?", a: "Currently, you can upload files up to 1GB for free." }
];

const FAQ = () => {
  return (
    <div className="space-y-6">
      {faqItems.map((item, i) => (
        <div 
          key={i}
          className="group bg-white p-8 neo-brutal cursor-pointer transition-all duration-300 hover:bg-[#FFFD82]"
        >
          <div className="flex justify-between items-center">
            <h4 className="text-2xl font-black uppercase">{item.q}</h4>
            <ChevronDown className="transition-transform duration-300 group-hover:rotate-180" />
          </div>
          <p className="mt-4 font-bold opacity-0 max-h-0 overflow-hidden transition-all duration-300 group-hover:max-h-40 group-hover:opacity-70">
            {item.a}
          </p>
        </div>
      ))}
    </div>
  );
};

export default FAQ;
