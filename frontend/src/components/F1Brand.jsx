import { Car } from 'lucide-react';
import './F1Brand.css';

export default function F1Brand({ size = 'md' }) {
  return (
    <div className={`f1-brand f1-brand--${size}`}>
      <div className="f1-brand-icon">
        <Car />
      </div>
      <div className="f1-brand-text">
        <span className="f1-brand-name">F1</span>
        <span className="f1-brand-sub">DataBase</span>
      </div>
    </div>
  );
}
