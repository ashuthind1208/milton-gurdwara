import Button from './Button';

const AdminHeaderActionButton = ({ label, onClick, className = '', variant = 'primary' }) => {
  return (
    <Button
      type="button"
      variant={variant}
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 px-2.5 py-1 text-xs font-semibold ${className}`}
      aria-label={label}
      title={label}
    >
      <span aria-hidden="true" className="text-sm leading-none sm:hidden">+</span>
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
};

export default AdminHeaderActionButton;