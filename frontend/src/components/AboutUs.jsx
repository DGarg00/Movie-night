export default function AboutUs() {
  return (
    <section>
      <div className="section-head"><div className="dot"></div><h2>About Us</h2></div>

      {/* Faculty in-charge — the "main" card: bigger, gold-bordered, featured */}
      <div className="about-card about-featured">
        <img
          className="about-photo about-photo-featured"
          src="https://drive.google.com/uc?export=view&id=1-Rzj-eLmv84mOkA_SBXQHcFwssSg1iNo"
          alt="Teacher name"
        />
        <div className="about-info">
          <span className="about-tag-featured">Faculty In-Charge</span>
          <h3 className="about-name-featured">Teacher's Full Name</h3>
          <p className="about-bio">
            Write a couple of sentences here — their role in the department,
            how long they've supported movie night, anything you'd like to say about them.
          </p>
        </div>
      </div>

      {/* The two student admins — smaller, plain cards side by side */}
      <div className="about-grid">
        <div className="about-card">
          <img className="about-photo" src="PASTE_YOUR_PHOTO_URL_HERE" alt="Your name" />
          <div className="about-info">
            <h3 className="about-name">Your Full Name</h3>
            <p className="about-bio">A line or two about yourself and your role running movie night.</p>
          </div>
        </div>

        <div className="about-card">
          <img className="about-photo" src="PASTE_FRIEND_PHOTO_URL_HERE" alt="Friend's name" />
          <div className="about-info">
            <h3 className="about-name">Friend's Full Name</h3>
            <p className="about-bio">A line or two about them and their role running movie night.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
