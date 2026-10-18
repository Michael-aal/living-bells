import { useEffect, useState } from 'react'
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

export default function Landing({ onRegister, theme = 'light', onToggleTheme = () => {} }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('home')
  const [scrollProgress, setScrollProgress] = useState(0)
  const [showBackToTop, setShowBackToTop] = useState(false)

  useEffect(() => {
    const updateScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight
      setScrollProgress(scrollable > 0 ? Math.min(100, (window.scrollY / scrollable) * 100) : 0)
      setShowBackToTop(window.scrollY > 500)
    }
    updateScroll()
    window.addEventListener('scroll', updateScroll, { passive: true })
    window.addEventListener('resize', updateScroll)

    const sections = ['home', 'welcome', 'ministries', 'gather']
      .map(id => document.getElementById(id))
      .filter(Boolean)
    let observer
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
            entry.target.classList.add('is-visible')
          }
        })
      }, { rootMargin: '-18% 0px -55% 0px', threshold: 0 })
      sections.forEach(section => observer.observe(section))
      document.querySelectorAll('.lb-reveal').forEach(section => observer.observe(section))
    } else {
      document.querySelectorAll('.lb-reveal').forEach(section => section.classList.add('is-visible'))
    }

    return () => {
      window.removeEventListener('scroll', updateScroll)
      window.removeEventListener('resize', updateScroll)
      observer?.disconnect()
    }
  }, [])

  const closeMobileMenu = () => setMobileMenuOpen(false)

  return <div className="lb-site">
    <div className="lb-scroll-progress" aria-hidden="true"><span style={{ width: scrollProgress + "%" }} /></div>
    <header className="lb-nav">
      <a className="lb-brand lb-nav-brand" href="#home" aria-label="Living Bells platform home"><span className="lb-brand-mark">L</span><span><strong>Living Bells™</strong><small>Church management platform</small></span></a>
      <nav className={'lb-nav-links ' + (mobileMenuOpen ? 'is-open' : '')} id="lb-mobile-navigation" aria-label="Main navigation">
        <a className={activeSection === 'welcome' ? 'is-active' : ''} href="#welcome" onClick={closeMobileMenu}>Our church</a>
        <a className={activeSection === 'ministries' ? 'is-active' : ''} href="#ministries" onClick={closeMobileMenu}>Ministries</a>
        <a className={activeSection === 'gather' ? 'is-active' : ''} href="#gather" onClick={closeMobileMenu}>Get connected</a>
      </nav>
      <div className="lb-nav-actions">
        <button type="button" className="theme-toggle landing-theme-toggle" onClick={onToggleTheme} aria-label={'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' mode'} title={'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' mode'}><span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span><span className="theme-toggle-label">{theme === 'dark' ? 'Light' : 'Dark'}</span></button>
        <button type="button" className="lb-mobile-menu-toggle" onClick={() => setMobileMenuOpen(value => !value)} aria-expanded={mobileMenuOpen} aria-controls="lb-mobile-navigation" aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}><span></span><span></span><span></span></button>
        <button className="lb-nav-cta" onClick={() => { closeMobileMenu(); onRegister() }}><i className="fa-solid fa-user-plus" aria-hidden="true"></i><span>Register</span></button>
      </div>
    </header>

    <main id="home">
      <section className="lb-hero lb-reveal">
        <div className="lb-hero-copy">
          <div className="lb-kicker"><span></span> FAITH · COMMUNITY · PURPOSE</div>
          <h1>A place to belong.<br/><em>A faith that lives.</em></h1>
          <p className="lb-hero-lead">Welcome to Foursquare Gospel Church, The Bells — a church family growing together in faith, love and service.</p>
          <div className="lb-hero-actions">
            <a className="lb-button-primary" href="#welcome" onClick={closeMobileMenu}>Discover our church <span>→</span></a>
            <a className="lb-button-quiet" href="#gather" onClick={closeMobileMenu}>Get connected</a>
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
        <div className="lb-gather-inner"><span className="lb-gather-kicker">YOUR NEXT STEP STARTS HERE</span><h2>Let’s grow<br/><em>together.</em></h2><p>We would love to help you find your place in the life of The Bells. Reach out to the church or come along and get to know the community.</p><a className="lb-button-light" href="#welcome" onClick={closeMobileMenu}>Get in touch <span>→</span></a></div>
        <div className="lb-gather-decoration"><i className="fa-solid fa-sparkles" aria-hidden="true"></i></div>
      </section>
    </main>

    <footer className="lb-footer">
      <a className="lb-brand lb-footer-brand" href="#home" aria-label="Living Bells platform home"><span className="lb-brand-mark">L</span><span><strong>Living Bells™</strong><small>Church management platform</small></span></a>
      <span className="lb-footer-copy">Foursquare Gospel Church, The Bells — growing in faith, living in love, serving with purpose.</span>
      <button className="lb-footer-portal" onClick={onRegister}><i className="fa-solid fa-user-plus" aria-hidden="true"></i> Register your church</button>
      <span className="lb-copyright">© {new Date().getFullYear()} The Bells</span>
    </footer>
    <button type="button" className={"lb-back-to-top " + (showBackToTop ? "is-visible" : "")} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Back to top" tabIndex={showBackToTop ? 0 : -1}>↑<span>Top</span></button>
  </div>
}
