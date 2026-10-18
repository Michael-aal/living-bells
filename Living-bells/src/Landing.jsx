import { useEffect, useState } from 'react'
import './landing.css'
import './landing-focus.css'

const features = [
  { icon: 'fa-regular fa-calendar-check', number: '01', title: 'Attendance', text: 'Keep Sunday services and attendance records organised in one dependable place.' },
  { icon: 'fa-solid fa-wallet', number: '02', title: 'Finance', text: 'Record giving, expenses and financial activity with clearer accountability.' },
  { icon: 'fa-solid fa-chart-column', number: '03', title: 'Reports & calendar', text: 'Bring reporting weeks, periods and saved records together so teams stay aligned.' },
  { icon: 'fa-solid fa-people-group', number: '04', title: 'People & staff', text: 'Give church teams the access they need, with roles that keep responsibilities clear.' },
]

export default function Landing({ onRegister, theme = 'light', onToggleTheme = () => {} }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('platform')
  const [scrollProgress, setScrollProgress] = useState(0)
  const [showBackToTop, setShowBackToTop] = useState(false)

  useEffect(() => {
    const handleEscape = event => {
      if (event.key === 'Escape') setMobileMenuOpen(false)
    }
    const updateScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight
      setScrollProgress(scrollable > 0 ? Math.min(100, (window.scrollY / scrollable) * 100) : 0)
      setShowBackToTop(window.scrollY > 500)
    }
    updateScroll()
    window.addEventListener('scroll', updateScroll, { passive: true })
    window.addEventListener('resize', updateScroll)
    document.addEventListener('keydown', handleEscape)

    const sections = ['platform', 'features', 'how-it-works']
      .map(id => document.getElementById(id))
      .filter(Boolean)
    let observer
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            if (sections.some(section => section.id === entry.target.id)) setActiveSection(entry.target.id)
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
      document.removeEventListener('keydown', handleEscape)
      observer?.disconnect()
    }
  }, [])

  const closeMobileMenu = () => setMobileMenuOpen(false)

  return <div className="lb-site lb-platform-site">
    <div className="lb-scroll-progress" aria-hidden="true"><span style={{ width: scrollProgress + '%' }} /></div>
    <header className="lb-nav lb-platform-nav">
      <a className="lb-brand lb-nav-brand" href="#platform" aria-label="Living Bells platform home">
        <span className="lb-brand-mark"><i className="fa-solid fa-bell" aria-hidden="true"></i></span>
        <span><strong>Living Bells™</strong><small>Church management platform</small></span>
      </a>
      <nav className={'lb-nav-links ' + (mobileMenuOpen ? 'is-open' : '')} id="lb-mobile-navigation" aria-label="Main navigation">
        <a className={activeSection === 'platform' ? 'is-active' : ''} href="#platform" onClick={closeMobileMenu}>Overview</a>
        <a className={activeSection === 'features' ? 'is-active' : ''} href="#features" onClick={closeMobileMenu}>Features</a>
        <a className={activeSection === 'how-it-works' ? 'is-active' : ''} href="#how-it-works" onClick={closeMobileMenu}>How it works</a>
      </nav>
      <div className="lb-nav-actions">
        <button type="button" className="theme-toggle landing-theme-toggle" onClick={onToggleTheme} aria-label={'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' mode'} title={'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' mode'}><span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span><span className="theme-toggle-label">{theme === 'dark' ? 'Light' : 'Dark'}</span></button>
        <button type="button" className="lb-mobile-menu-toggle" onClick={() => setMobileMenuOpen(value => !value)} aria-expanded={mobileMenuOpen} aria-controls="lb-mobile-navigation" aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}><span></span><span></span><span></span></button>
        <button type="button" className="lb-nav-cta" onClick={() => { closeMobileMenu(); onRegister() }}><i className="fa-solid fa-arrow-right-to-bracket" aria-hidden="true"></i><span>Register your church</span></button>
      </div>
    </header>

    <main id="platform">
      <section className="lb-platform-hero lb-reveal">
        <div className="lb-platform-copy">
          <div className="lb-kicker"><span></span> BUILT FOR CHURCH LIFE</div>
          <h1>Less time managing.<br /><em>More time ministering.</em></h1>
          <p className="lb-platform-lead">A clearer way for churches to organise attendance, finances, activities, people and reports — all in one secure workspace.</p>
          <div className="lb-hero-actions">
            <button type="button" className="lb-button-primary" onClick={onRegister}>Register your church <span>→</span></button>
            <a className="lb-button-quiet" href="#features" onClick={closeMobileMenu}>Explore the platform <span aria-hidden="true">↓</span></a>
          </div>
          <div className="lb-platform-proof"><span className="lb-proof-icon"><i className="fa-solid fa-shield-halved" aria-hidden="true"></i></span><span><b>Your church. Your workspace.</b><small>Church accounts and teams stay separate.</small></span></div>
        </div>
        <div className="lb-platform-visual" aria-label="Illustration of an organised church dashboard">
          <div className="lb-visual-glow"></div>
          <div className="lb-dashboard-window">
            <div className="lb-dashboard-top"><span className="lb-mini-brand"><i className="fa-solid fa-bell" aria-hidden="true"></i></span><span><b>Church workspace</b><small>Sunday service overview</small></span><span className="lb-live-dot">● Live view</span></div>
            <div className="lb-dashboard-greeting"><small>YOUR CHURCH AT A GLANCE</small><b>A more organised week.</b></div>
            <div className="lb-dashboard-metrics">
              <div><span><i className="fa-solid fa-users" aria-hidden="true"></i></span><small>Attendance</small><b>Records</b><em>Ready to review</em></div>
              <div><span><i className="fa-solid fa-wallet" aria-hidden="true"></i></span><small>Finance</small><b>Overview</b><em>Clearer tracking</em></div>
            </div>
            <div className="lb-dashboard-row"><span className="lb-row-icon"><i className="fa-regular fa-calendar-check" aria-hidden="true"></i></span><span><b>Reporting calendar</b><small>Weeks and periods in sync</small></span><i className="fa-solid fa-arrow-right" aria-hidden="true"></i></div>
            <div className="lb-dashboard-row"><span className="lb-row-icon"><i className="fa-solid fa-chart-line" aria-hidden="true"></i></span><span><b>Saved reports</b><small>Records your team can find</small></span><i className="fa-solid fa-arrow-right" aria-hidden="true"></i></div>
          </div>
          <div className="lb-floating-note"><span><i className="fa-solid fa-check" aria-hidden="true"></i></span><b>Everything in its place</b></div>
          <span className="lb-platform-orbit lb-platform-orbit-one"></span><span className="lb-platform-orbit lb-platform-orbit-two"></span>
        </div>
      </section>

      <section className="lb-platform-strip" aria-label="Platform principles">
        <div><i className="fa-solid fa-layer-group" aria-hidden="true"></i><span>One organised workspace</span></div>
        <div><i className="fa-solid fa-user-shield" aria-hidden="true"></i><span>Role-based access</span></div>
        <div><i className="fa-solid fa-calendar-days" aria-hidden="true"></i><span>Structured reporting</span></div>
        <div><i className="fa-solid fa-people-roof" aria-hidden="true"></i><span>Built around church teams</span></div>
      </section>

      <section className="lb-platform-features lb-reveal" id="features">
        <div className="lb-section-label">THE WORKSPACE <span>01 / FEATURES</span></div>
        <div className="lb-platform-section-heading"><div><span className="lb-section-eyebrow">A PLACE FOR THE PRACTICAL DETAILS</span><h2>Church work,<br /><em>working together.</em></h2></div><p>Bring everyday administration into one shared flow, so your team can spend less energy chasing records and more energy caring for people.</p></div>
        <div className="lb-platform-feature-grid">{features.map(item => <article className="lb-platform-feature" key={item.number}><div className="lb-feature-top"><span className="lb-feature-icon"><i className={item.icon} aria-hidden="true"></i></span><span>{item.number}</span></div><h3>{item.title}</h3><p>{item.text}</p><span className="lb-feature-line"></span></article>)}</div>
      </section>

      <section className="lb-platform-process lb-reveal" id="how-it-works">
        <div className="lb-process-copy"><span className="lb-section-eyebrow">GETTING STARTED</span><h2>Your church,<br /><em>your own space.</em></h2><p>Each church begins with its own account and workspace. Once the church account is approved, its administrator can organise the team and start setting up the church’s records.</p><button type="button" className="lb-button-primary" onClick={onRegister}>Start a church registration <span>→</span></button></div>
        <div className="lb-process-steps">
          <article><span>01</span><div><h3>Request an account</h3><p>Submit your church details for review.</p></div></article>
          <article><span>02</span><div><h3>Get approved</h3><p>The platform team reviews the request and shares the decision.</p></div></article>
          <article><span>03</span><div><h3>Set up your team</h3><p>Your church administrator can configure the workspace and invite staff.</p></div></article>
        </div>
      </section>

      <section className="lb-platform-cta lb-reveal">
        <div><span className="lb-gather-kicker">MAKE ROOM FOR WHAT MATTERS</span><h2>Bring the admin together.<br /><em>Keep the mission at the centre.</em></h2><p>Give your church team a clearer place to manage the work behind the work.</p></div>
        <button type="button" className="lb-button-light" onClick={onRegister}>Register your church <span>→</span></button>
        <span className="lb-cta-decoration" aria-hidden="true"><i className="fa-solid fa-bell"></i></span>
      </section>
    </main>

    <footer className="lb-platform-footer">
      <span className="lb-footer-mark"><i className="fa-solid fa-bell" aria-hidden="true"></i></span>
      <span className="lb-footer-description"><b>Made for church teams.</b><small>Organise the details. Make more room for ministry.</small></span>
      <span className="lb-platform-footer-copy">© {new Date().getFullYear()} Living Bells</span>
    </footer>
    <button type="button" className={'lb-back-to-top ' + (showBackToTop ? 'is-visible' : '')} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Back to top" tabIndex={showBackToTop ? 0 : -1}>↑<span>Top</span></button>
  </div>
}
