import { St1Repository, IStoredTweetDoc } from "./St1Repository";

const atlasUri: string = process.env.MONGODB_ATLAS_CLUSTER_URI_R || "";
const st1Repo = new St1Repository(atlasUri);

st1Repo.findAll().subscribe(
    (st1data: IStoredTweetDoc) => process.stdout.write(JSON.stringify(st1data) + "\n"),
    (error) => process.stderr.write("Failed to read from mongo " + error + "\n"),
    () => process.exit(),
);
