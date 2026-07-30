export default function NoticeBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="notice-banner">
      <div className="notice-banner-title">📣 Notice</div>
      <div className="notice-banner-msg">{message}</div>
      <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={onDismiss}>OK</button>
    </div>
  );
}