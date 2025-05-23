import { motion } from 'framer-motion';
import Link from 'next/link';

import { MessageIcon, VercelIcon } from './icons';


//Overview component is exported
//This component is used to display the overview of the chatbot
//It is a functional component  
//It uses motion.div to animate the component
//It uses Link from next/link to provide links to the user

export const Overview = () => {
  return (
    <motion.div
      key="overview"
      className="max-w-3xl mx-auto md:mt-20"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ delay: 0.5 }}
    >
      <div className="rounded-xl p-6 flex flex-col gap-8 leading-relaxed text-center max-w-xl">
        <p className="flex flex-row justify-center gap-4 items-center">
          
          <span></span>
          
        </p>
        <p>
          Welcome to Klever{' '}
          <Link
            className="font-medium underline underline-offset-4"
            href="https://www.kleverinc.com"
            target="_blank"
          >
            AI
          </Link>{' '}
          {' '}
          <code className="rounded-md bg-muted px-1 py-0.5"></code>{' '}
          {' '}
          <code className="rounded-md bg-muted px-1 py-0.5"></code> 
          
        </p>
        <p>
          {' '}
          <Link
            className="font-medium underline underline-offset-4"
            href="https://www.kleverinc.com"
            target="_blank"
          >
            
          </Link>
          
        </p>
      </div>
    </motion.div>
  );
};
