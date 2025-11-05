import React from "react";
import HTMLFlipBook from "react-pageflip";
import "./App.css";

const PageCover = React.forwardRef((props, ref) => (
  <div className="page page-cover" ref={ref} data-density="soft">
    <div className="page-content">
      <h2>{props.children}</h2>
    </div>
  </div>
));

const Page = React.forwardRef((props, ref) => (
  <div className="page" ref={ref}>
    <div className="page-content">
      {/* <h2 className="page-header">Page header - {props.number}</h2> */}
      <div className="page-text">{props.children}</div>
      {/* <div className="page-footer">Page {props.number + 1}</div> */}
    </div>
  </div>
));

class DemoBook extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      pages: [],
      page: 0,
      totalPage: 0,
      orientation: "",
      state: "",
    };
  }

  nextButtonClick = () => this.flipBook.pageFlip().flipNext();
  prevButtonClick = () => this.flipBook.pageFlip().flipPrev();

  onPage = (e) => this.setState({ page: e.data });
  onChangeOrientation = (e) => this.setState({ orientation: e.data });
  onChangeState = (e) => this.setState({ state: e.data });

  handleKeyDown = (e) => {
    if (!this.flipBook) return;
    if (e.key === "ArrowRight") {
      this.nextButtonClick();
    } else if (e.key === "ArrowLeft") {
      this.prevButtonClick();
    }
  };

  async componentDidMount() {
    try {
      const urls = ["/page0.html", "/page1.html", "/page2.html", "/page5.html", "/page6.html", "/page7.html"];
      const pages = [];

      for (let url of urls) {
        const response = await fetch(url);
        const html = await response.text();
        pages.push(html);
      }

      this.setState({ pages });
      window.addEventListener("keydown", this.handleKeyDown);
    } catch (error) {
      console.error("Ошибка загрузки страницы:", error);
    }
    
    const cursor = document.createElement("div");
    cursor.id = "custom-cursor";
    cursor.style.cssText = `
    display: none;
      position: fixed;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: white;
      mix-blend-mode: difference;
      pointer-events: none;
      z-index: 99999;
      box-shadow: 0 0 8px rgba(255, 255, 255, 0.8);
    `;
    document.body.appendChild(cursor);

    window.addEventListener("mousemove", (e) => {
      cursor.style.left = (e.clientX - 14) + "px";
      cursor.style.top = (e.clientY - 14) + "px";
    });

    window.addEventListener("mousedown", () => {
      cursor.style.transform = "scale(0.7)";
    });

    window.addEventListener("mouseup", () => {
      cursor.style.transform = "scale(1)";
    });
  }

  componentWillUnmount() {
    // Убираем обработчик при размонтировании
    window.removeEventListener("keydown", this.handleKeyDown);
  }

  render() {
    const { pages } = this.state;

      if (pages.length === 0) return <p>Загрузка страниц...</p>;

      return (
      <div className="flipbook-container">
        <HTMLFlipBook
          width={595}
          height={842}
          showCover={false}
          maxShadowOpacity={1}
          flippingTime={700}
          mobileScrollSupport={false}
          ref={(el) => (this.flipBook = el)}
        >
          <PageCover></PageCover>

          {pages.map((html, i) => (
            <Page key={i} number={i + 1}>
              <div dangerouslySetInnerHTML={{ __html: html }} />
            </Page>
          ))}

          <PageCover>THE END</PageCover>
        </HTMLFlipBook>
        </div>
      );
    }
    
}

export default DemoBook;
