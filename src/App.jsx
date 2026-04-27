import { Link } from "react-router-dom";
import { CustomCursor } from "./components/CustomCursor.jsx";

function App() {
  const navItems = ["home", "about", "map", "chat"];
  const featureCards = [
    {
      id: "map",
      title: "1.在地圖標記地點",
      description: "選擇你們相遇的確切位置",
      defaultImage: "/src/assets/illustrations/map-1.png",
      hoverImage: "/src/assets/illustrations/map-2.png",
    },
    {
      id: "write",
      title: "2.寫下你看到的他/她",
      description: "描述外貌、當下的情境",
      defaultImage: "/src/assets/illustrations/boy-1.png",
      hoverImage: "/src/assets/illustrations/boy-2.png",
    },
    {
      id: "subscribe",
      title: "3.訂閱常去的地方",
      description: "有新貼文時我們會通知你",
      defaultImage: "/src/assets/illustrations/phone-1.png",
      hoverImage: "/src/assets/illustrations/phone-2.png",
    },
    {
      id: "chat",
      title: "4.通過驗證才能開聊",
      description: "保護雙方隱私與安全",
      defaultImage: "/src/assets/illustrations/Chat-1.png",
      hoverImage: "/src/assets/illustrations/Chat-2.png",
    },
  ];
  return (
    <div className="home-page">
      <header className="top-nav">
        <Link className="brand" to="/">
          Findsomeone
        </Link>
        <nav className="top-nav-center" aria-label="Main navigation">
          {navItems.map((item) => (
            <Link key={item} className="top-nav-link" to={item === "home" ? "/" : `/${item}`}>
              {item}
            </Link>
          ))}
        </nav>
        <Link className="avatar-button" to="/profile" aria-label="Login or profile">
          <img src="/src/assets/illustrations/profile.png" alt="profile" />
        </Link>
      </header>

      <main className="home-main">
        <section className="hero-section">
          <div className="hero-copy">
            <p className="hero-label">HOMEPAGE</p>
            <h1>跟某人錯過？</h1>
            <p className="hero-subtext">把那個瞬間寫下來，也許他/她正在等你。</p>
          </div>

          <Link className="hero-image-button" to="/post" aria-label="發布尋找">
            <img
              className="hero-button-image default"
              src="/src/assets/illustrations/button_1.png"
              alt="發布尋找"
            />
            <img
              className="hero-button-image active"
              src="/src/assets/illustrations/button_2.png"
              alt="發布尋找 active"
            />
          </Link>
        </section>

        <section className="feature-grid" aria-label="Feature introduction">
          {featureCards.map((card) => (
            <article className="feature-card feature-card--illustration" key={card.id}>
              <div className="feature-image-wrap">
                <img
                  className="feature-image default"
                  src={card.defaultImage}
                  alt=""
                  aria-hidden="true"
                />
                <img
                  className="feature-image hover"
                  src={card.hoverImage}
                  alt=""
                  aria-hidden="true"
                />
              </div>
              <h2>{card.title}</h2>
              <p>{card.description}</p>
            </article>
          ))}
        </section>
      </main>
      <CustomCursor />
    </div>
  );
}

export default App
