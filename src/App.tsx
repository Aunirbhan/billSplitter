import { useRoute } from "./router";
import { Landing } from "./screens/Landing";
import { Capture } from "./screens/Capture";
import { Review } from "./screens/Review";
import { Room } from "./screens/Room";
import { Settings } from "./screens/Settings";

export default function App() {
  const route = useRoute();
  switch (route.name) {
    case "scan":
      return <Capture />;
    case "review":
      return <Review />;
    case "room":
      return <Room blob={route.blob} />;
    case "bill":
      return <Room savedId={route.id} />;
    case "settings":
      return <Settings />;
    default:
      return <Landing />;
  }
}
