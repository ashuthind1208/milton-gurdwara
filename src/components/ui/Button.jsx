const variants = {
  primary: 'bg-brand-blue text-white hover:bg-blue-800',
  secondary: 'bg-brand-saffron text-slate-900 hover:bg-amber-500',
  ghost: 'bg-white/70 text-slate-900 ring-1 ring-slate-200 hover:bg-white dark:bg-slate-800 dark:text-white dark:ring-slate-700'
};

const Button = ({ type = 'button', variant = 'primary', className = '', children, ...props }) => {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-xl px-5 py-2.5 font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
