import { Button } from "@repo/ui/button";
  import styles from "./page.module.css"; 
import { PlusIcon } from "lucide-react";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>Prompt Market</h1>  <p>Discover and use prompts in an agentic, automated workflow.</p>
        <Button appName="web" className={styles.secondary}>
          List prompts
        </Button>
          <Button appName="web" className={styles.secondary}>  
            <PlusIcon />
            Create prompt
          </Button>
        </main>
    </div>
  );
}
