import React from 'react';
import { ChevronDown } from 'lucide-react';
import { faqItems } from '../lib/faq';

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
