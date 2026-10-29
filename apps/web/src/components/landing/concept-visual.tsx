import {
  ArrowUpRight,
  Check,
  Compass,
  FileText,
  MapPin,
  MessagesSquare,
  Navigation,
  Route,
  Search,
  Store,
  Trees,
  TriangleAlert,
} from "lucide-react";
import { getT } from "@/lib/web/i18n";
import styles from "./concept-visual.module.css";

const t = getT("landing");

/** Original abstract geography, not a navigable map or a real app capture. */
function IllustratedMap() {
  return (
    <svg
      viewBox="0 0 800 560"
      fill="none"
      className={styles.mapDrawing}
      aria-hidden
    >
      <path fill="#e7eddc" d="M0 0h800v560H0z" />
      <path
        fill="#d6e1c8"
        d="m0 0 278 0-29 91-119 20L0 66ZM579 0h221v166l-99-28-70-64ZM0 357l119-30 76 84-35 149H0ZM476 450l117-42 100 33 107-19v138H464Z"
      />
      <path
        fill="#dce6ce"
        d="m67 173 79-22 62 48-22 77-98 12-40-54ZM461 82l68 7 13 67-74 30-46-43ZM574 288l115-13 34 76-77 42-77-31Z"
      />
      <path
        stroke="#c9d9eb"
        strokeWidth="54"
        d="M642-40c-98 105 45 128-29 219-75 92-173 65-166 154 7 84-81 115-112 262"
      />
      <path
        stroke="#b8cde2"
        strokeWidth="2"
        d="M642-40c-98 105 45 128-29 219-75 92-173 65-166 154 7 84-81 115-112 262"
      />
      <g stroke="#fafbf6" strokeWidth="16" strokeLinejoin="round">
        <path d="M-30 148 233 119 376 256 820 213M-30 377l225-59 174 35 181 159 290-16" />
        <path d="m263-25-30 144-38 199 38 264M442-30l-66 286-7 97-20 240M800 95 690 117l-27 184 44 281" />
        <path d="m73 94 42 139 244-32M54 481l82-72 116 40M501 108l65 1M496 400l148-53 154 29M282 22l143 32" />
      </g>
      <g stroke="#d4d8ca" strokeWidth="1.5">
        <path d="m-30 148 263-29 143 137 444-43M-30 377l225-59 174 35 181 159 290-16M263-25l-30 144-38 199 38 264M442-30l-66 286-7 97-20 240M800 95 690 117l-27 184 44 281" />
      </g>
      <g fill="#d5d5c8" stroke="#c8cbbb" strokeWidth="1">
        <rect
          x="254"
          y="153"
          width="33"
          height="25"
          rx="4"
          transform="rotate(12 254 153)"
        />
        <rect
          x="299"
          y="179"
          width="25"
          height="35"
          rx="4"
          transform="rotate(-18 299 179)"
        />
        <rect x="248" y="249" width="44" height="28" rx="4" />
        <rect x="310" y="278" width="28" height="41" rx="4" />
        <rect
          x="247"
          y="353"
          width="37"
          height="25"
          rx="4"
          transform="rotate(12 247 353)"
        />
        <rect x="280" y="402" width="33" height="28" rx="4" />
        <rect
          x="487"
          y="231"
          width="34"
          height="24"
          rx="4"
          transform="rotate(-7 487 231)"
        />
        <rect x="554" y="245" width="27" height="32" rx="4" />
        <rect x="710" y="245" width="33" height="45" rx="4" />
        <rect x="729" y="404" width="43" height="26" rx="4" />
        <rect
          x="97"
          y="309"
          width="38"
          height="23"
          rx="4"
          transform="rotate(-12 97 309)"
        />
      </g>
      <g fill="#aabe9b">
        <circle cx="98" cy="208" r="10" />
        <circle cx="119" cy="190" r="8" />
        <circle cx="150" cy="225" r="12" />
        <circle cx="106" cy="249" r="7" />
        <circle cx="473" cy="124" r="9" />
        <circle cx="493" cy="143" r="8" />
        <circle cx="604" cy="326" r="11" />
        <circle cx="632" cy="309" r="9" />
        <circle cx="649" cy="344" r="12" />
        <circle cx="629" cy="363" r="7" />
        <circle cx="92" cy="447" r="11" />
        <circle cx="76" cy="475" r="9" />
      </g>
      <path
        stroke="#fff"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m233 399-38-81 38-199 143 137 145-14"
      />
      <path
        stroke="#8d7bb7"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="1 10"
        d="m233 399-38-81 38-199 143 137 145-14"
      />
      <circle
        cx="233"
        cy="399"
        r="10"
        fill="#8d7bb7"
        stroke="white"
        strokeWidth="5"
      />
      <circle
        cx="521"
        cy="242"
        r="10"
        fill="#8d7bb7"
        stroke="white"
        strokeWidth="5"
      />
    </svg>
  );
}

export function HeroConcept() {
  return (
    <figure className={styles.heroFigure}>
      <div className={styles.heroScene} aria-hidden="true">
        <div className={styles.orbitOne} />
        <div className={styles.orbitTwo} />
        <div className={styles.desktop}>
          <div className={styles.windowBar}>
            <span className={styles.windowDots}>
              <i />
              <i />
              <i />
            </span>
            <span>
              <Compass size={13} />
              {t("brand")}
            </span>
            <span className={styles.windowLine} />
          </div>
          <div className={styles.desktopBody}>
            <div className={styles.sidebar}>
              <div className={styles.sideTitle}>{t("studio.yourProvince")}</div>
              <div className={styles.searchLabel}>
                <Search size={13} />
                {t("studio.findLocal")}
              </div>
              <div className={styles.sideItem}>
                <span className={styles.mintIcon}>
                  <MapPin size={17} />
                </span>
                {t("studio.places")}
              </div>
              <div className={styles.sideItem}>
                <span className={styles.butterIcon}>
                  <Store size={17} />
                </span>
                {t("studio.businesses")}
              </div>
              <div className={styles.sideItem}>
                <span className={styles.lavenderIcon}>
                  <Route size={17} />
                </span>
                {t("studio.routes")}
              </div>
              <div className={styles.sideNote}>
                <Trees size={26} strokeWidth={1.4} />
                <span>{t("studio.closeToHome")}</span>
              </div>
            </div>
            <div className={styles.heroMap}>
              <IllustratedMap />
              <span className={`${styles.mapLabel} ${styles.labelSabaneta}`}>
                {t("sabaneta")}
              </span>
              <span className={`${styles.mapLabel} ${styles.labelMoncion}`}>
                {t("moncion")}
              </span>
              <span className={`${styles.mapLabel} ${styles.labelAlmacigos}`}>
                {t("almacigos")}
              </span>
              <span className={`${styles.mapPin} ${styles.pinStore}`}>
                <Store size={20} />
              </span>
              <span className={`${styles.mapPin} ${styles.pinTree}`}>
                <Trees size={20} />
              </span>
              <span className={`${styles.mapPin} ${styles.pinPlace}`}>
                <MapPin size={21} />
              </span>
            </div>
          </div>
        </div>
        <div className={styles.floatingNote}>
          <span>
            <MapPin size={17} />
          </span>
          {t("studio.localPerspective")}
          <ArrowUpRight size={15} />
        </div>
        <div className={styles.phone}>
          <div className={styles.phoneIsland} />
          <div className={styles.phoneHeading}>
            {t("studio.discover")}
            <Compass size={18} />
          </div>
          <p className={styles.phoneSubheading}>{t("studio.madeForHere")}</p>
          <div className={styles.phoneArt}>
            <div className={styles.artSun} />
            <div className={styles.artHillBack} />
            <div className={styles.artHillFront} />
            <div className={styles.artPath} />
            <span>
              <Trees size={35} strokeWidth={1.5} />
            </span>
          </div>
          <div className={styles.phoneCardTitle}>
            {t("studio.nextAdventure")}
            <ArrowUpRight size={16} />
          </div>
          <div className={styles.phoneTags}>
            <span>
              <Route size={12} />
              {t("studio.routes")}
            </span>
            <span>
              <MapPin size={12} />
              {t("studio.places")}
            </span>
          </div>
          <div className={styles.phoneSeparator} />
          <div className={styles.phoneCommunity}>
            <span className={styles.lavenderIcon}>
              <MessagesSquare size={17} />
            </span>
            <div>
              {t("studio.yourCommunity")}
              <small>{t("studio.participateAndFollow")}</small>
            </div>
          </div>
          <div className={styles.phoneHome} />
        </div>
        <div className={styles.routeNote}>
          <span className={styles.lavenderIcon}>
            <Navigation size={18} />
          </span>
          <div>
            {t("studio.newPerspectives")}
            <small>{t("studio.everydayPaths")}</small>
          </div>
        </div>
      </div>
      <figcaption className={styles.caption}>
        {t("studio.conceptLabel")}
      </figcaption>
    </figure>
  );
}

export function RoutesConcept() {
  return (
    <figure className={`${styles.detailFigure} ${styles.routesFigure}`}>
      <div className={styles.routesScene} aria-hidden="true">
        <span className={styles.sceneTag}>
          <Route size={14} />
          {t("studio.pathsAndPlaces")}
        </span>
        <div className={styles.routeMapPaper}>
          <IllustratedMap />
          <span className={styles.routeCompass}>
            <Navigation size={21} />
          </span>
        </div>
        <div className={styles.routeSlip}>
          <span className={styles.mintIcon}>
            <Trees size={22} />
          </span>
          <div>
            {t("studio.goAtYourPace")}
            <small>{t("studio.checkBeforeLeaving")}</small>
          </div>
          <ArrowUpRight size={18} />
        </div>
        <span className={styles.conditionNote}>
          <TriangleAlert size={16} />
          {t("studio.roadConditions")}
        </span>
      </div>
      <figcaption className={styles.caption}>
        {t("studio.conceptLabel")}
      </figcaption>
    </figure>
  );
}

export function LocalConcept() {
  return (
    <figure className={`${styles.detailFigure} ${styles.localFigure}`}>
      <div className={styles.localScene} aria-hidden="true">
        <span className={styles.sceneTag}>
          <Store size={14} />
          {t("studio.localCommerce")}
        </span>
        <div className={styles.shopCard}>
          <div className={styles.shopIllustration}>
            <div className={styles.shopSun} />
            <div className={styles.shopBuilding}>
              <div className={styles.shopRoof} />
              <div className={styles.shopAwning}>
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
              <div className={styles.shopWindow} />
              <div className={styles.shopDoor} />
              <div className={styles.shopPlant} />
            </div>
          </div>
          <div className={styles.shopCardBottom}>
            <span className={styles.butterIcon}>
              <Store size={19} />
            </span>
            <div>
              {t("studio.localCommerce")}
              <small>{t("studio.contactAndHours")}</small>
            </div>
            <MapPin size={19} />
          </div>
        </div>
        <div className={styles.localPin}>
          <MapPin size={28} strokeWidth={1.5} />
        </div>
        <div className={styles.localNote}>
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
      <figcaption className={styles.caption}>
        {t("studio.conceptLabel")}
      </figcaption>
    </figure>
  );
}

export function CommunityConcept() {
  return (
    <figure className={styles.communityFigure}>
      <div className={styles.communityScene} aria-hidden="true">
        <span className={styles.sceneTag}>
          <MessagesSquare size={14} />
          {t("studio.yourCommunity")}
        </span>
        <div className={styles.communityOrbit} />
        <div className={styles.reportPaper}>
          <span className={styles.butterIcon}>
            <FileText size={24} />
          </span>
          <p>{t("studio.weeklyReport")}</p>
          <div className={styles.paperLines}>
            <i />
            <i />
            <i />
          </div>
          <div className={styles.barChart}>
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
        <div className={styles.communityPaper}>
          <span className={styles.lavenderIcon}>
            <MessagesSquare size={25} />
          </span>
          <p>{t("studio.aSharedPriority")}</p>
          <div className={styles.paperLines}>
            <i />
            <i />
          </div>
          <div className={styles.progressSteps}>
            <span>
              <Check size={12} />
            </span>
            <i />
            <span>
              <Check size={12} />
            </span>
            <i />
            <span />
          </div>
          <small>{t("studio.followTheConversation")}</small>
        </div>
        <div className={styles.communityBubble}>
          <MessagesSquare size={25} strokeWidth={1.5} />
        </div>
      </div>
      <figcaption className={styles.caption}>
        {t("studio.conceptLabel")}
      </figcaption>
    </figure>
  );
}
