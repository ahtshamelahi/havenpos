import './Loader.css';

export default function Loader({ fullScreen = false, text = 'Loading...' }) {
  return (
    <div className={`loader-container ${fullScreen ? 'full-screen' : ''}`}>
      <div className="loader-spinner"></div>
      {text && <div className="loader-text">{text}</div>}
    </div>
  );
}
