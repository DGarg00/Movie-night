export default function AboutUs() {
  return (
    <section>
      <div className="section-head"><div className="dot"></div><h2>About Us</h2></div>

      {/* Faculty in-charge — the "main" card: bigger, gold-bordered, featured */}
      <div className="about-card about-featured">
        <img
          className="about-photo about-photo-featured"
          src="https://drive.google.com/thumbnail?id=1DFESa8xV8JITu-no-8O7HWlUfnTv6xh6&sz=w1000"
          alt="Teacher name"
        />
        <div className="about-info">
          <span className="about-tag-featured">Faculty In-Charge</span>
          <h3 className="about-name-featured">Shri Nanda Gopal</h3>
          <p className="about-bio">
            A all-rounder professor and faculty in-charge of student activities.
     He has supported our Saturday movie nights since they began.
          </p>
        </div>
      </div>

      {/* The two student admins — smaller, plain cards side by side */}
      <div className="about-grid">
        <div className="about-card">
          <img className="about-photo" src="PASTE_YOUR_PHOTO_URL_HERE" alt="Your name" />
          <div className="about-info">
            <h3 className="about-name">Divya Garg</h3>
            <p className="about-bio">Trying his level best to give best movies but rejected everytime.</p>
          </div>
        </div>

        <div className="about-card">
          <img className="about-photo" src="PASTE_FRIEND_PHOTO_URL_HERE" alt="Friend's name" />
          <div className="about-info">
            <h3 className="about-name">Bharata Sridatta Vishvnath</h3>
            <p className="about-bio">Trying his level best to give best movies but rejected everytime.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
