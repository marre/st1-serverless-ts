import { St1Repository } from "./St1Repository";

const atlasUri: string = process.env.MONGODB_ATLAS_CLUSTER_URI_R || "";
const st1Repo = new St1Repository(atlasUri);

st1Repo.findAll().subscribe(
    (st1data) => process.stdout.write(JSON.stringify(st1data)),
    (error) => process.stderr.write("Failed to read from mongo " + error + "\n"),
    () => process.exit(),
);
