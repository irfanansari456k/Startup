import { useEffect, useMemo, useRef, useState } from 'react'
import { isSupabaseConfigured, supabase, supabaseConfigError } from './supabase'
import './App.css'

const products = [
  {
    id: 'boiler-kata-hua',
    name: 'Boiler Kata Hua',
    kind: 'Boiler fresh cut',
    detail: 'Dressed boiler, cleaned and ready for curry.',
    referencePrice: 250,
    notes: ['Dressed & cleaned', 'Cut to size on request'],
    tag: 'Popular',
  },
  {
    id: 'khada-boiler',
    name: 'Khada Boiler',
    kind: 'Live poultry',
    detail: 'Live or whole boiler bird.',
    referencePrice: 160,
    notes: ['Weighed alive in cage', 'Fresh halal preparation'],
  },
  {
    id: 'cockrel',
    name: 'Cockrel',
    kind: 'Farm breed',
    detail: 'Firm texture with a distinct, rich taste.',
    referencePrice: 250,
    notes: ['Great for slow gravies', 'Hand cut to order'],
  },
  {
    id: 'layer',
    name: 'Layer',
    kind: 'Country style',
    detail: 'Hearty chicken cut, a warming soup base.',
    referencePrice: 200,
    notes: ['High marrow density', 'Value home-cooking cut'],
  },
  {
    id: 'desi-chicken',
    name: 'Desi Chicken',
    kind: 'Free-range local',
    detail: 'Village-raised poultry with an authentic flavor.',
    referencePrice: 400,
    notes: ['Authentic country bird', 'Rich broth and flavor'],
    tag: 'Desi pure',
  },
]

const cuts = [
  {
    icon: '🍲',
    title: 'Curry cut',
    description:
      'A balanced mix of bone-in leg, thigh, back, and breast pieces for everyday gravies.',
  },
  {
    icon: '🍛',
    title: 'Biryani pieces',
    description:
      'Generous cuts that stay tender through slow dum cooking with basmati rice.',
  },
  {
    icon: '🔪',
    title: 'Boneless breast & thigh',
    description:
      'Cleanly trimmed fillets for butter chicken, tikka, rolls, or stir fries.',
  },
  {
    icon: '🥣',
    title: 'Fresh keema',
    description:
      'Hand-prepared to order on a clean cutting block. Please call ahead.',
  },
]

const phone = '+918085515659'
const whatsapp = '918085515659'
const mapsUrl = 'https://maps.google.com/?q=Umariya+Isra+Chhindwara'
const rupees = new Intl.NumberFormat('en-IN')
const referenceRates = Object.fromEntries(products.map((item) => [item.id, item.referencePrice]))
const emptyRateDraft = Object.fromEntries(products.map((item) => [item.id, '']))

async function fetchShopRates() {
  const { data, error } = await supabase
    .from('shop_rates')
    .select('product_id, price_inr, updated_at')
    .order('product_id')

  if (error) {
    throw error
  }

  const prices = Object.fromEntries(
    (data ?? []).map((rate) => [rate.product_id, Number(rate.price_inr)]),
  )
  const missingProduct = products.find(
    (item) => !Number.isFinite(prices[item.id]) || prices[item.id] <= 0,
  )

  if (missingProduct) {
    throw new Error(
      data?.length
        ? 'The rate table is incomplete. Enter all five current prices in the shopkeeper rate editor.'
        : 'No rates have been published yet. A shopkeeper must enter current prices in the rate editor.',
    )
  }

  const latestUpdate = (data ?? [])
    .map((rate) => rate.updated_at)
    .filter(Boolean)
    .sort()
    .at(-1)

  return { prices, latestUpdate }
}

function whatsappUrl(message) {
  return `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`
}

function App() {
  const [selectedProduct, setSelectedProduct] = useState(products[0].name)
  const [weight, setWeight] = useState('1')
  const [remoteRates, setRemoteRates] = useState(null)
  const [ratesLoading, setRatesLoading] = useState(isSupabaseConfigured)
  const [ratesError, setRatesError] = useState(supabaseConfigError)
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState(null)
  const [session, setSession] = useState(null)
  const [adminCheckStatus, setAdminCheckStatus] = useState('checking')
  const [adminError, setAdminError] = useState('')
  const [adminBusy, setAdminBusy] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const editorDialogRef = useRef(null)
  const [loginEmail, setLoginEmail] = useState('')
  const [password, setPassword] = useState('')
  const [editorPrices, setEditorPrices] = useState(emptyRateDraft)
  const [saveMessage, setSaveMessage] = useState('')

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return undefined
    }

    let active = true
    fetchShopRates()
      .then(({ prices, latestUpdate }) => {
        if (active) {
          setRemoteRates(prices)
          setEditorPrices(prices)
          setRatesUpdatedAt(latestUpdate)
          setRatesError('')
        }
      })
      .catch((error) => {
        if (active) {
          setRemoteRates(null)
          setRatesError(`Could not load live rates: ${error.message}`)
        }
      })
      .finally(() => {
        if (active) {
          setRatesLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!supabase) {
      return undefined
    }

    let active = true

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) {
        return
      }

      if (error) {
        setAdminError(`Could not restore sign-in: ${error.message}`)
      }
      setSession(data.session)
      setAdminCheckStatus(data.session ? 'checking' : 'signed-out')
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAdminCheckStatus(nextSession ? 'checking' : 'signed-out')
      setAdminError('')
      setPassword('')
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!supabase || !session) {
      return undefined
    }

    let active = true
    supabase
      .from('shop_admins')
      .select('user_id')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) {
          return
        }

        if (error) {
          setAdminError(`Could not verify shopkeeper access: ${error.message}`)
          setAdminCheckStatus('unauthorized')
        } else {
          setAdminCheckStatus(data ? 'authorized' : 'unauthorized')
        }
      })

    return () => {
      active = false
    }
  }, [session])

  useEffect(() => {
    const dialog = editorDialogRef.current
    if (!dialog) {
      return
    }

    if (editorOpen && !dialog.open) {
      dialog.showModal()
    } else if (!editorOpen && dialog.open) {
      dialog.close()
    }
  }, [editorOpen])

  const product = products.find((item) => item.name === selectedProduct) ?? products[0]
  const adminStatus = session ? adminCheckStatus : 'signed-out'
  const displayedRates = isSupabaseConfigured
    ? remoteRates
    : supabaseConfigError
      ? null
      : referenceRates
  const selectedPrice = displayedRates?.[product.id] ?? null
  const validWeight =
    weight !== '' &&
    Number.isFinite(Number(weight)) &&
    Number(weight) >= 0.1 &&
    Number(weight) <= 50
  const total = useMemo(
    () => (validWeight && selectedPrice !== null ? Math.round(selectedPrice * Number(weight)) : null),
    [selectedPrice, validWeight, weight],
  )

  function chooseProduct(name) {
    setSelectedProduct(name)
    document.getElementById('price-calculator')?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
  }

  const orderMessage = validWeight && total !== null
    ? `Please keep ${Number(weight).toFixed(1)} kg ${product.name} ready. I understand the estimate of ₹${rupees.format(total)} is not a confirmed final bill.`
    : ''

  async function handleAdminLogin(event) {
    event.preventDefault()
    if (!supabase) {
      return
    }

    setAdminBusy(true)
    setAdminError('')
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim().toLowerCase(),
      password,
    })
    setAdminBusy(false)

    if (error) {
      setAdminError(`Sign-in failed: ${error.message}`)
      return
    }

    setPassword('')
  }

  async function handleAdminLogout() {
    if (!supabase) {
      return
    }

    setAdminBusy(true)
    const { error } = await supabase.auth.signOut()
    setAdminBusy(false)

    if (error) {
      setAdminError(`Sign-out failed: ${error.message}`)
    }
  }

  async function handleSaveRates(event) {
    event.preventDefault()
    if (!supabase || !session) {
      return
    }

    const updates = products.map((item) => ({
      product_id: item.id,
      price_inr: Number(editorPrices[item.id]),
      updated_by: session.user.id,
    }))

    if (updates.some((rate) => !Number.isFinite(rate.price_inr) || rate.price_inr <= 0 || rate.price_inr > 10000)) {
      setAdminError('Enter a rate greater than ₹0 and no higher than ₹10,000 per kilogram.')
      return
    }

    setAdminBusy(true)
    setAdminError('')
    setSaveMessage('')
    const { error } = await supabase
      .from('shop_rates')
      .upsert(updates, { onConflict: 'product_id' })

    if (error) {
      setAdminError(`Could not save rates: ${error.message}`)
      setAdminBusy(false)
      return
    }

    try {
      const { prices, latestUpdate } = await fetchShopRates()
      setRemoteRates(prices)
      setRatesUpdatedAt(latestUpdate)
      setRatesError('')
      setEditorPrices(prices)
      setSaveMessage('Rates saved and published.')
    } catch (error) {
      setRatesError(`Rates were saved, but could not be reloaded: ${error.message}`)
      setAdminError(`Rates were saved, but could not be reloaded: ${error.message}`)
    } finally {
      setAdminBusy(false)
    }
  }

  return (
    <>
      <div className="notice-bar">
        <div className="container notice-content">
          <span className="open-pill"><span className="status-dot" /> Open today · 8:00 AM–7:00 PM</span>
          <span className="notice-detail">✓ 100% halal verified daily cuts</span>
          <a href={mapsUrl} target="_blank" rel="noreferrer">Near Bus Stand, Umariya Isra</a>
          <a href={`tel:${phone}`}>☎ <span>+91 80855 15659</span></a>
        </div>
      </div>

      <header className="site-header">
        <div className="container header-content">
          <a className="brand" href="#top" aria-label="Taj Chicken Shop home">
            <span className="brand-mark" aria-hidden="true">T</span>
            <span className="brand-copy">
              <strong>Taj Chicken Shop</strong>
              <small>ARIF BHAI · UMARIYA ISRA</small>
            </span>
          </a>
          <nav className="main-nav" aria-label="Main navigation">
            <a href="#daily-rates">Today’s rates</a>
            <a href="#our-cuts">Our cuts</a>
            <a href="#visit-store">Visit us</a>
          </nav>
          <div className="header-actions">
            <a className="button button-outline button-compact" href={`tel:${phone}`}>☎ <span>Call hotline</span></a>
            <a
              className="button button-primary button-compact"
              href={whatsappUrl('I want to order chicken from Taj Chicken Shop.')}
              target="_blank"
              rel="noreferrer"
            >
              ▣ <span>Order on WhatsApp</span>
            </a>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="hero-section">
          <div className="container hero-grid">
            <div className="hero-copy">
              <div className="eyebrow"><span aria-hidden="true">✦</span> Trusted neighborhood butcher · Umariya Isra</div>
              <h1>Taj Chicken Shop <span lang="hi">(ताज चिकन शॉप - आरिफ भाई)</span></h1>
              <p className="proprietor">Proprietor: <strong>Sheikh Arif Mansuri</strong></p>
              <p className="hero-description">
                Fresh, hygienically dressed halal poultry, customized cuts, and genuine homestyle
                chicken spices. Trusted daily service near the Bus Stand in Umariya Isra,
                Chhindwara.
              </p>
              <div className="trust-list" aria-label="Shop information">
                <span>✓ Daily fresh stock</span>
                <span>✦ 100% halal certified</span>
                <span>▦ UPI & cash accepted</span>
                <span>⚖ Exact scale weight</span>
              </div>
              <div className="hero-actions">
                <a className="button button-primary" href="#daily-rates">▤ Check today’s rates <span lang="hi">(आज का भाव)</span></a>
                <a
                  className="button button-outline"
                  href={whatsappUrl("What's today's chicken rate?")}
                  target="_blank"
                  rel="noreferrer"
                >
                  ▣ WhatsApp inquiry
                </a>
              </div>
              <p className="hero-note">
                {isSupabaseConfigured
                  ? 'Rates are fetched from the shop rate board. Confirm the final bill at the counter.'
                  : supabaseConfigError
                    ? supabaseConfigError
                    : 'Reference prices from the design only. Please confirm today’s price with the shop.'}
              </p>
            </div>

            <div className="shop-visual" aria-label="Taj Chicken Shop in Umariya Isra">
              <div className="visual-topline"><span>UMARIYA ISRA MARKET</span><span className="live-label"><span className="status-dot" /> OPEN</span></div>
              <div className="storefront-art" aria-hidden="true">
                <div className="awning"><span /><span /><span /><span /><span /><span /></div>
                <div className="shop-sign"><small>आरिफ भाई का</small><strong>TAJ CHICKEN SHOP</strong><small>FRESH · CLEAN · HALAL</small></div>
                <div className="storefront">
                  <div className="store-window"><span>FRESH DAILY</span></div>
                  <div className="store-door"><span>OPEN</span></div>
                  <div className="store-window"><span>UMARIYA ISRA</span></div>
                </div>
                <div className="shop-counter"><span>✦</span> Since day one, serving our neighborhood</div>
              </div>
              <div className="visual-caption">
                <div><strong>Taj Chicken Shop</strong><span>Sheikh Arif Mansuri at the counter</span></div>
                <span className="location-chip">📍 Main Road, Umariya Isra</span>
              </div>
            </div>
          </div>
        </section>

        <section className="section rates-section" id="daily-rates">
          <div className="container">
            <div className="section-heading heading-with-aside">
              <div>
                <span className="section-kicker">▦ Authentic butcher ledger</span>
                <h2>Daily rate board <span lang="hi">(आज के ताज़ा भाव)</span></h2>
                <p>
                  {isSupabaseConfigured
                    ? 'Rates published by the shop. Final weight and bill are confirmed at the counter.'
                    : 'Reference prices from the design. Final weight and current bill are confirmed at the counter.'}
                </p>
              </div>
              <div className="updated-note"><span>◷</span><div><small>{isSupabaseConfigured ? 'RATE BOARD' : 'REFERENCE PRICES'}</small><strong>{ratesLoading ? 'Loading rates…' : ratesUpdatedAt ? `Updated ${ratesUpdatedAt.slice(0, 16).replace('T', ' ')}` : isSupabaseConfigured ? 'Live rates unavailable' : 'Not live'}</strong><span>{isSupabaseConfigured ? 'Confirm final weight at counter' : 'Call to confirm today’s rates'}</span></div></div>
            </div>

            {ratesError && <div className="rates-alert" role="alert">{ratesError} <a href={`tel:${phone}`}>Call the shop to confirm current prices.</a></div>}

            <div className="product-grid">
              {products.map((item) => {
                const price = displayedRates?.[item.id] ?? null
                return <article className="product-card" key={item.id}>
                  <div className="product-art" aria-hidden="true"><span>{item.name === 'Desi Chicken' ? '🌿' : '🍗'}</span>{item.tag && <span className="product-tag">{item.tag}</span>}</div>
                  <div className="product-content">
                    <span className="product-kind">{item.kind}</span>
                    <h3>{item.name}</h3>
                    <p className="product-description">{item.detail}</p>
                    <strong className="product-price">{price === null ? ratesLoading ? 'Loading…' : 'Unavailable' : <>₹{rupees.format(price)} <small>/ kg</small></>}</strong>
                    <ul>{item.notes.map((note) => <li key={note}><span aria-hidden="true">✓</span>{note}</li>)}</ul>
                    <button className="text-button" type="button" onClick={() => chooseProduct(item.name)}>Calculate this rate <span aria-hidden="true">→</span></button>
                  </div>
                </article>
              })}
            </div>

            <div className="calculator" id="price-calculator">
              <div className="calculator-copy">
                <span className="section-kicker">⌖ Quick bill estimator</span>
                <h3>Interactive price calculator</h3>
                <p>Choose a variety and weight to estimate your order before visiting the counter.</p>
                <div className="estimate-disclaimer">ⓘ This is an estimate only. The final bill is calculated using the shop’s scale and confirmed price.</div>
              </div>
              <div className="calculator-controls">
                <label htmlFor="variety">Select variety</label>
                <select id="variety" value={selectedProduct} onChange={(event) => setSelectedProduct(event.target.value)}>
                  {products.map((item) => {
                    const price = displayedRates?.[item.id]
                    return <option key={item.id} value={item.name}>{item.name} ({price === undefined ? 'rate unavailable' : `₹${rupees.format(price)}/kg`})</option>
                  })}
                </select>
                <label htmlFor="weight">Weight in kilograms</label>
                <input
                  id="weight"
                  type="number"
                  inputMode="decimal"
                  min="0.1"
                  max="50"
                  step="0.1"
                  value={weight}
                  onChange={(event) => setWeight(event.target.value)}
                  aria-describedby="weight-help"
                />
                <span className="field-help" id="weight-help">Enter a weight from 0.1 to 50 kg.</span>
                <span className="quick-label">Quick portions</span>
                <div className="portion-buttons">
                  {[0.5, 1, 1.5, 2].map((portion) => (
                    <button className={Number(weight) === portion ? 'portion active' : 'portion'} type="button" key={portion} onClick={() => setWeight(String(portion))}>{portion} kg</button>
                  ))}
                </div>
                <div className="estimate-total" aria-live="polite">
                  <div><span>Estimated total</span><strong>{total === null ? '—' : `₹${rupees.format(total)}`}</strong></div>
                  <span>{validWeight ? `${Number(weight).toFixed(1)} kg of ${product.name}` : 'Enter a valid weight to calculate'}</span>
                </div>
                {validWeight && total !== null ? (
                  <a className="button button-primary order-button" href={whatsappUrl(orderMessage)} target="_blank" rel="noreferrer">▣ Send order note on WhatsApp</a>
                ) : (
                  <button className="button button-primary order-button" type="button" disabled>▣ Send order note on WhatsApp</button>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="section cuts-section" id="our-cuts">
          <div className="container cuts-layout">
            <div className="hygiene-card">
              <div className="hygiene-illustration" aria-hidden="true"><span>✦</span><div className="knife-art">╱</div><div className="board-art">FRESH CUTS</div></div>
              <div className="hygiene-caption"><span className="hygiene-icon">✚</span><div><strong>Hygienic cutting protocol</strong><p>Clean cutting block and knives, cared for throughout the day.</p></div></div>
            </div>
            <div className="cuts-copy">
              <span className="section-kicker">Skilled butcher cutting</span>
              <h2>Cuts customized to your pot & recipe</h2>
              <p>Arif Bhai prepares pieces to suit the way your family cooks. Tell us your dish and we’ll portion it accordingly.</p>
              <div className="cut-grid">
                {cuts.map((cut) => (
                  <article className="cut-item" key={cut.title}>
                    <span className="cut-icon" aria-hidden="true">{cut.icon}</span>
                    <div><h3>{cut.title}</h3><p>{cut.description}</p></div>
                  </article>
                ))}
              </div>
              <div className="custom-note"><strong>Counter customization:</strong> Let Arif Bhai know if you prefer small curry cuts, medium pieces, or large biryani-style cuts when ordering.</div>
            </div>
          </div>
        </section>

        <section className="section spice-section">
          <div className="container spice-layout">
            <div className="spice-copy">
              <span className="section-kicker">One-stop counter convenience</span>
              <h2>Chicken masalas & whole spices</h2>
              <p>Pick up freshly replenished chicken masalas and whole garam spices alongside your meat order.</p>
              <div className="spice-list">
                <div><span>01</span><p><strong>Branded masala boxes</strong>Everest, MDH, Badshah, and Ramdev chicken masalas.</p></div>
                <div><span>02</span><p><strong>Whole garam masala</strong>Cardamom, cloves, cinnamon, star anise, and more.</p></div>
                <div><span>03</span><p><strong>Clear pack pricing</strong>Prices vary by brand and pack size. Check the MRP in-store.</p></div>
              </div>
              <a className="button button-outline" href={whatsappUrl('Please add one chicken masala pack to my order.')} target="_blank" rel="noreferrer">＋ Add masala to WhatsApp order</a>
            </div>
            <div className="spice-visual" aria-label="Chicken masala and whole spices">
              <div className="spice-bowl bowl-one"><span>✹</span><small>GARAM MASALA</small></div>
              <div className="spice-bowl bowl-two"><span>✺</span><small>FRESH SPICES</small></div>
              <div className="spice-packet"><span>TAJ</span><strong>CHICKEN<br />MASALA</strong><small>AROMATIC BLEND</small></div>
              <p>Freshly stocked at the neighborhood counter</p>
            </div>
          </div>
        </section>

        <section className="quote-section">
          <div className="container quote-layout">
            <div className="quote-art" aria-hidden="true"><span>✧</span><span>♨</span><span>✧</span></div>
            <div className="quote-copy">
              <span className="section-kicker">From counter to handi</span>
              <h2>Arif Bhai’s cooking advice for Umariya Isra families</h2>
              <p>“Freshly dressed poultry needs less tenderizing. For Boiler Kata Hua, sear the pieces with a spoon of desi ghee, whole cardamom, and bay leaf before simmering in browned onion gravy.”</p>
              <div className="cooking-tips"><div><strong>For Desi Chicken</strong><span>Slow pressure cooking helps soften country-bird meat into a nourishing salan.</span></div><div><strong>For Cockrel</strong><span>Simmer gently with crushed pepper and garlic for a hearty broth.</span></div></div>
              <strong className="quote-signoff">“ताज़ा चिकन, सच्चा स्वाद” <span>— Sheikh Arif Mansuri</span></strong>
            </div>
          </div>
        </section>

        <section className="section visit-section" id="visit-store">
          <div className="container">
            <div className="section-heading">
              <span className="section-kicker">Welcome to our counter</span>
              <h2>Visit store & timings</h2>
              <p>Find us on the main bus stand stretch in Umariya Isra, with two-wheeler parking near the counter.</p>
            </div>
            <div className="visit-grid">
              <article className="visit-card">
                <span className="visit-icon" aria-hidden="true">⌖</span>
                <h3>Store address</h3>
                <p>Taj Chicken Shop<br />Near Bus Stand, Umariya Isra<br />District Chhindwara, Madhya Pradesh 480001</p>
                <a href={mapsUrl} target="_blank" rel="noreferrer">Open in Google Maps ↗</a>
              </article>
              <article className="visit-card">
                <span className="visit-icon" aria-hidden="true">◷</span>
                <h3>Counter hours</h3>
                <p>Monday to Sunday<br /><strong>8:00 AM–7:00 PM</strong><br />Fresh batch arrives around 8:00 AM.</p>
                <span className="hours-status"><span className="status-dot" /> Open seven days a week</span>
              </article>
              <article className="visit-card contact-card">
                <span className="section-kicker">Proprietor contact</span>
                <h3>Arif Bhai</h3>
                <a href={`tel:${phone}`}>+91 80855 15659</a>
                <p>WhatsApp quick orders<br /><strong>+91 80855 15659</strong></p>
                <span className="payment-note">UPI accepted · PhonePe · Google Pay · Paytm · Cash</span>
              </article>
            </div>
            <div className="directions-card">
              <div><span className="section-kicker">Easy to find</span><h3>How to reach the counter</h3></div>
              <ol>
                <li><strong>From Chhindwara:</strong> Take the main Umariya Isra road toward the bus depot.</li>
                <li><strong>At the bus stand:</strong> Look for Arif Bhai’s Taj Chicken Shop signboard.</li>
                <li><strong>Need directions?</strong> Call <a href={`tel:${phone}`}>+91 80855 15659</a>.</li>
              </ol>
              <a className="button button-primary" href={mapsUrl} target="_blank" rel="noreferrer">↗ Get directions</a>
            </div>
            <div className="backend-note">
              <div><span aria-hidden="true">⚙</span><div><strong>Daily rate editor</strong><p>{isSupabaseConfigured ? 'Rate board connected. Only the approved shopkeeper account can change published prices.' : 'Reference rates are shown until Supabase is configured.'}</p></div></div>
              <button
                type="button"
                disabled={!isSupabaseConfigured}
                onClick={() => {
                  setAdminError('')
                  setSaveMessage('')
                  setEditorPrices(remoteRates ?? emptyRateDraft)
                  setEditorOpen(true)
                }}
              >
                {isSupabaseConfigured ? 'Open rate editor' : 'Supabase setup required'}
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-content">
          <a className="footer-brand" href="#top">Taj Chicken Shop <span>ARIF BHAI · UMARIYA ISRA</span></a>
          <p>© Taj Chicken Shop · Umariya Isra, Chhindwara, Madhya Pradesh</p>
          <div className="footer-links">
            <a href="#daily-rates">Today’s rates</a><span>·</span><a href="#visit-store">Directions & hours</a><span>·</span><a href={`tel:${phone}`}>Call the shop</a>
          </div>
        </div>
      </footer>
      <div className="mobile-order-bar"><a href={whatsappUrl('I want to order chicken from Taj Chicken Shop.')} target="_blank" rel="noreferrer">▣ Order on WhatsApp</a><a href={`tel:${phone}`}>☎ Call</a></div>
      <dialog
        className="editor-dialog"
        ref={editorDialogRef}
        aria-labelledby="rate-editor-title"
        onClose={() => setEditorOpen(false)}
      >
        <div className="editor-header">
          <div><span className="section-kicker">Shopkeeper access</span><h2 id="rate-editor-title">Daily rate editor</h2></div>
          <button className="editor-close" type="button" aria-label="Close rate editor" onClick={() => setEditorOpen(false)}>×</button>
        </div>
        {adminError && <p className="editor-message error-message" role="alert">{adminError}</p>}
        {!session || adminStatus === 'signed-out' ? (
          <form className="editor-form" onSubmit={handleAdminLogin}>
            <p className="editor-description">Sign in with the approved shopkeeper account to publish price changes.</p>
            <label htmlFor="admin-email">Shopkeeper email</label>
            <input id="admin-email" type="email" autoComplete="username" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} required />
            <label htmlFor="admin-password">Password</label>
            <input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            <button className="button button-primary" type="submit" disabled={adminBusy}>{adminBusy ? 'Signing in…' : 'Sign in securely'}</button>
          </form>
        ) : adminStatus === 'checking' ? (
          <p className="editor-description" role="status">Verifying shopkeeper permissions…</p>
        ) : adminStatus === 'authorized' ? (
          <form className="editor-form" onSubmit={handleSaveRates}>
            <p className="editor-description">Signed in as {session.user.email}. Changes publish immediately to the public rate board.</p>
            {products.map((item) => (
              <label className="editor-rate-field" htmlFor={`rate-${item.id}`} key={item.id}>
                <span>{item.name} <small>₹ / kg</small></span>
                <input
                  id={`rate-${item.id}`}
                  type="number"
                  min="1"
                  max="10000"
                  step="1"
                  inputMode="numeric"
                  value={editorPrices[item.id] ?? ''}
                  onChange={(event) => setEditorPrices((current) => ({ ...current, [item.id]: event.target.value }))}
                  required
                />
              </label>
            ))}
            {saveMessage && <p className="editor-message success-message" role="status">{saveMessage}</p>}
            <div className="editor-actions">
              <button className="button button-primary" type="submit" disabled={adminBusy}>{adminBusy ? 'Saving…' : 'Save and publish rates'}</button>
              <button className="editor-signout" type="button" onClick={handleAdminLogout} disabled={adminBusy}>Sign out</button>
            </div>
          </form>
        ) : (
          <div className="editor-form">
            <p className="editor-message error-message" role="alert">This account is not authorized to edit shop rates. Add the confirmed shopkeeper account to <code>shop_admins</code> in Supabase.</p>
            <button className="editor-signout" type="button" onClick={handleAdminLogout} disabled={adminBusy}>Sign out</button>
          </div>
        )}
      </dialog>
    </>
  )
}

export default App
