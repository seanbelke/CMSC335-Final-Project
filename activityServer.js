process.stdin.setEncoding("utf8");

if (process.argv.length != 3) {
  process.stdout.write(`Usage ${process.argv[1]} portNumber`);
  process.exit(1);
}

/* libraries */
const http = require("http")
const express = require("express")
const path = require("path")
const app = express()
const bodyParser = require("body-parser");
const portNumber = Number(process.argv[2]);

/* configuring paths */
app.set("views", path.resolve(__dirname, "templates"));
app.set("view engine", "ejs")

app.use(bodyParser.urlencoded({extended:false}));

require("dotenv").config({ path: path.resolve(__dirname, '.env') })

const userName   = process.env.MONGO_DB_USERNAME;
const password   = process.env.MONGO_DB_PASSWORD;
const database   = process.env.MONGO_DB_NAME;
const collection = process.env.MONGO_COLLECTION;
const { MongoClient, ServerApiVersion } = require('mongodb');
const { table } = require("console");

let uri, client;

async function main() {
  uri = `mongodb+srv://${userName}:${password}@atlascluster.s3ippzb.mongodb.net/?retryWrites=true&w=majority`;
  client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

  await client.connect()
}

main().catch(console.error)

/* endpoints */
app.get("/", (request, response) => {
  response.render("index")
})

app.get("/newUser", (request, response) => {
  response.render("newUser.ejs")
})

app.get("/returningUser", (req, res) => {
    res.render("returningUser.ejs")
})

function tableFromList(list) {
    let table = `<table border="1"><tr><th>Activity</th></tr>`

    list.forEach((elem) => {
        table += `<tr><td>${elem}</td></tr>`
    })

    table += `</table>`
    return table
}

app.post("/processNewUser", (request, response) => {
  let variables = {
    name: request.body.name,
    email: request.body.email,
    activities: request.body.activities.trim().split(/[\r\n]+/),
  }

  client.db(database).collection(collection).insertOne(variables);

  response.render("viewActivities", {name: variables.name, table: tableFromList(variables.activities)})
})

app.post("/login", (request, response) => {
    let filter = {name: request.body.name}
    client.db(database).collection(collection).findOne(filter).then(
        doc => {
            if (doc == null) {
                console.log("User attempted to login with invalid name")
                response.render("returningUser")
            } else {

                response.render("viewActivities", {name: request.body.name, table: tableFromList(doc.activities)})
            }
        }
    )
})

app.post("/addActivity", (request, response) => {
    let name = request.body.name
    let newActivity = request.body.newActivity
    let filter = {name: name}
    client.db(database).collection(collection).findOne(filter).then(
        record => {
            let activities = record.activities;
            activities.push(newActivity)
            // update old record
            client.db(database).collection(collection).updateOne({name: name},
                {
                    $set: {
                        activities: activities
                    }
                })
            response.render("viewActivities", {name: name, table: tableFromList(activities)})
        }
    )
})

app.post("/generateNewActivity", (request, response) => {
    let name = request.body.name2
    let filter = {name: name}

    fetch("http://www.boredapi.com/api/activity/").then(response => response.json()).then(newActivity => {
        client.db(database).collection(collection).findOne(filter).then(
            record => {
                let activities = record.activities;
                activities.push(newActivity.activity)
                // update old record
                client.db(database).collection(collection).updateOne({name: name},
                    {
                        $set: {
                            activities: activities
                        }
                    })
                response.render("viewActivities", {name: name, table: tableFromList(activities)})
            }
        )
    })
})

app.get("/reviewApplication", (request, response) => {
  response.render("reviewApp")
})

app.post("/processReviewApplication", (request, response) => {
  let email = request.body.email

  let filter = {email: email} 
  client.db(database).collection(collection).findOne(filter).then(
    record => {
      let recordSafe = record ?? {
        name: "NONE",
        email: "NONE",
        gpa: "NONE",
        backgroundInfo: "NONE"
      }
      response.render("displayApp", {...recordSafe, date: new Date()})
    })
})

app.get("/adminGPA", (request, response) => {
  response.render("gpa")
})

app.post("/processAdminGPA", (request, response) => {
  let gpa = request.body.gpa

  let filter = {gpa: {$gte: gpa}}
  client.db(database).collection(collection).find(filter).toArray().then(
    xs => {
      let table = `<table border="1"><tr><th>Name</th><th>GPA</th></tr>`
      xs.forEach(elem => {
        table += `<tr><td>${elem.name}</td><td>${elem.gpa}</td></tr>`
      })
      table += "</table>"
      response.render("gpaResult", {table: table})
    }
  )
})

app.get("/adminRemove", (request, response) => {
  response.render("remove")
})

app.get("/processAdminRemove", (request, response) => {
  let filter = {}
  client.db(database).collection(collection).deleteMany(filter).then(result => {
    response.render("processRemove", {numRemoved: result.deletedCount})
  })
})

/* command line */
app.listen(portNumber);
console.log(`Web server started and running at http://localhost:${portNumber}`)

const prompt = "Stop to shut down the server: ";
process.stdout.write(prompt);
process.stdin.on("readable", function () {
  let dataInput = process.stdin.read();
  if (dataInput !== null) {
    let command = dataInput.trim().toLowerCase();
    if (command === "stop") {
      client.close()
      process.exit(0);
    } else {
      process.stdout.write(`Invalid command: ${dataInput}`)
    }
    process.stdout.write(prompt);
    process.stdin.resume();
  }
});


