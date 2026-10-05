import './landing.css'

const highlights = [
  { number: '01', title: 'Grow in faith', text: 'A place to learn, pray and build a lasting relationship with God.' },
  { number: '02', title: 'Find community', text: 'Walk alongside people who encourage, support and grow with one another.' },
  { number: '03', title: 'Live with purpose', text: 'Discover meaningful ways to serve your church and make a difference.' },
]

const ministries = [
  { icon: 'fa-solid fa-children', title: 'Children & Teens', text: 'Helping the next generation build a strong foundation of faith.' },
  { icon: 'fa-solid fa-people-group', title: 'Youth & Young Adults', text: 'A community to grow, connect and make faith part of everyday life.' },
  { icon: 'fa-solid fa-hands-praying', title: 'Worship & Prayer', text: 'Gathering together in worship, prayer and the Word.' },
  { icon: 'fa-solid fa-hand-holding-heart', title: 'Outreach & Service', text: 'Sharing hope and serving people in our wider community.' },
]

export default function Landing({ onSignIn }) {
  return <div className="lb-site">
    <header className="lb-nav">
      <a className="lb-brand" href="#home" aria-label="Living Bells home">
        <span className="lb-brand-mark">L</span>
        <span><strong>Living Bells</strong><small>Foursquare Gospel Church · The Bells</small></span>
      </a>
      <nav className="lb-nav-links" aria-label="Main navigation">
        <a href="#welcome">Our church</a><a href="#ministries">Ministries</a><a href="#gather">Get connected</a>
      </nav>
      <button className="lb-nav-cta" onClick={onSignIn}><i className="fa-solid fa-arrow-right-to-bracket" aria-hidden="true"></i><span>Staff portal</span></button>
    </header>

    <main id="home">
      <section className="lb-hero lb-reveal">
        <div className="lb-hero-copy">
          <div className="lb-kicker"><span></span> FAITH · COMMUNITY · PURPOSE</div>
          <h1>A place to belong.<br/><em>A faith that lives.</em></h1>
          <p className="lb-hero-lead">Welcome to Foursquare Gospel Church, The Bells — a church family growing together in faith, love and service.</p>
          <div className="lb-hero-actions">
            <a className="lb-button-primary" href="#welcome">Discover our church <span>→</span></a>
            <a className="lb-button-quiet" href="#gather">Get connected</a>
          </div>
          <div className="lb-hero-note"><span className="lb-note-icon"><i className="fa-solid fa-sparkles" aria-hidden="true"></i></span><span><b>Faith for everyday life</b><small>Growing together, serving together.</small></span></div>
        </div>
        <div className="lb-hero-art" aria-label="Abstract warm stained-glass inspired artwork">
          <div className="lb-art-orbit lb-orbit-one"></div><div className="lb-art-orbit lb-orbit-two"></div>
          <div className="lb-art-sun"></div><div className="lb-art-cross">✝</div>
          <div className="lb-art-caption"><span>THE BELLS</span><b>Rooted in faith.<br/>Connected in love.</b></div>
          <div className="lb-art-side">F O U R S Q U A R E&nbsp; G O S P E L&nbsp; C H U R C H</div>
        </div>
      </section>

      <section className="lb-welcome lb-reveal" id="welcome">
        <div className="lb-section-label">WELCOME HOME <span>01 / OUR CHURCH</span></div>
        <div className="lb-welcome-grid">
          <h2>Church is more than<br/>a place. <em>It’s people.</em></h2>
          <div><p>We believe faith grows best in community. Whether you are exploring faith, returning to church or looking for a place to serve, there is room for you here.</p><p>At The Bells, we want to be a community where people are encouraged to know God, care for one another and carry hope into the world around them.</p></div>
        </div>
        <div className="lb-values">{highlights.map(item => <article className="lb-value" key={item.number}><span>{item.number}</span><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
      </section>

      <section className="lb-ministries lb-reveal" id="ministries">
        <div className="lb-section-label">FIND YOUR PLACE <span>02 / LIFE TOGETHER</span></div>
        <div className="lb-ministry-heading"><h2>There’s a place<br/>for <em>you here.</em></h2><p>Discover ways to connect, grow and take part in the life of our church.</p></div>
        <div className="lb-ministry-grid">{ministries.map(item => <article className="lb-ministry" key={item.title}><span className="lb-ministry-icon"><i className={item.icon} aria-hidden="true"></i></span><h3>{item.title}</h3><p>{item.text}</p><span className="lb-ministry-arrow"><i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></span></article>)}</div>
      </section>

      <section className="lb-gather lb-reveal" id="gather">
        <div className="lb-gather-inner"><span className="lb-gather-kicker">YOUR NEXT STEP STARTS HERE</span><h2>Let’s grow<br/><em>together.</em></h2><p>We would love to help you find your place in the life of The Bells. Reach out to the church or come along and get to know the community.</p><a className="lb-button-light" href="#welcome">Get in touch <span>→</span></a></div>
        <div className="lb-gather-decoration"><i className="fa-solid fa-sparkles" aria-hidden="true"></i></div>
      </section>
    </main>

    <footer className="lb-footer">
      <a className="lb-brand" href="#home"><span className="lb-brand-mark">L</span><span><strong>Living Bells</strong><small>Foursquare Gospel Church · The Bells</small></span></a>
      <span className="lb-footer-copy">Growing in faith. Living in love. Serving with purpose.</span>
      <button className="lb-footer-portal" onClick={onSignIn}><i className="fa-solid fa-arrow-right-to-bracket" aria-hidden="true"></i> Staff portal</button>
      <span className="lb-copyright">© {new Date().getFullYear()} The Bells</span>
    </footer>
  </div>
}
