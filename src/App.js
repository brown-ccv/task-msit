import React, { useState, useEffect, useCallback } from "react";
import "./App.css";
import "bootstrap/dist/css/bootstrap.css";
import "@fortawesome/fontawesome-free/css/all.css";
import Login from "./components/Login";
import { jsPsych } from "jspsych-react";
import { getTurkUniqueId, getProlificId, sleep } from "./lib/utils";
import { initParticipant, addToFirebase } from "./firebase";
import JsPsychExperiment from "./components/JsPsychExperiment";
import {
  MTURK,
  IS_ELECTRON,
  FIREBASE,
  PROLIFIC,
  VIDEO,
  VOLUME,
  USE_EVENT_MARKER,
  USE_PHOTODIODE
} from "./config/main";

function App() {
  // Variables for time
  const  startDate = new Date().toISOString();
  // Variables for login
  const [loggedIn, setLogin] = useState(false);
  const [ipcRenderer, setRenderer] = useState(false);
  const [psiturk, setPsiturk] = useState(false);
  const [envParticipantId, setEnvParticipantId] = useState("");
  const [envStudyId, setEnvStudyId] = useState("");
  const [currentMethod, setMethod] = useState("default");
  const [reject, setReject] = useState(false);
  

  // Validation functions for desktop case and firebase
  const defaultValidation = async () => {
    return true;
  };
  const firebaseValidation = (participantId, studyId) => {
    return initParticipant(participantId, studyId, startDate);
  };

  // Adding data functions for firebase, electron adn Mturk
  const defaultFunction = (data) => {};
  const firebaseUpdateFunction = (data) => {
    addToFirebase(data);
  };
  const desktopUpdateFunction = (data) => {
    ipcRenderer.send("data", data);
  };
  const psiturkUpdateFunction = (data) => {
    psiturk.recordTrialData(data);
  };

  // On finish functions for electron, Mturk
  const desktopFinishFunction = () => {
    ipcRenderer.send("end", "true");
  };
  const psiturkFinishFunction = () => {
    const completePsiturk = async () => {
      psiturk.saveData();
      await sleep(5000);
      psiturk.completeHIT();
    };
    completePsiturk();
  };

  // Function to add jspsych data on login
  const setLoggedIn = useCallback(
    (loggedIn, studyId, participantId) =>{
      jsPsych.data.addProperties({
        participant_id: participantId,
        study_id: studyId,
        start_date: startDate,
      });
      setLogin(loggedIn)
    },
    [startDate],
  )

  // Login logic
  useEffect(() => {
    // For testing and debugging purposes
    console.log("Outside Turk:", jsPsych.turk.turkInfo().outsideTurk);
    console.log("Turk:", MTURK);
    console.log("Firebase:", FIREBASE);
    console.log("Prolific:", PROLIFIC);
    console.log("Electron:", IS_ELECTRON);
    console.log("Video:", VIDEO);
    console.log("Volume:", VOLUME);
    console.log("Event Marker:", USE_EVENT_MARKER);
    console.log("Photodiode:", USE_PHOTODIODE);
    // If on desktop
    if (IS_ELECTRON) {
      const electron = window.require("electron");
      const renderer = electron.ipcRenderer;
      setRenderer(renderer);
      // If at home, fill in fields based on environment variables
      const credentials = renderer.sendSync("syncCredentials");
      if (credentials.envParticipantId) {
        setEnvParticipantId(credentials.envParticipantId);
      }
      if (credentials.envStudyId) {
        setEnvStudyId(credentials.envStudyId);
      }
      setMethod("desktop");
      // If online
    } else {
      // If MTURK
      if (MTURK) {
        /* eslint-disable */
        window.lodash = _.noConflict();
        const turkId = getTurkUniqueId();
        setPsiturk(new PsiTurk(turkId, "/complete"));
        setMethod("mturk");
        setLoggedIn(true, "mturk", turkId)
        /* eslint-enable */
      }
      // If prolific
      else if (PROLIFIC) {
        const pID = getProlificId();
        if (FIREBASE && pID) {
          setMethod("firebase");
          setLoggedIn(true, "prolific", pID);
        } else {
          setReject(true);
        }
      }
      // If firebase
      else if (FIREBASE) {
        setMethod("firebase");
      } else {
        setReject(true);
      }
    }
  }, [setLoggedIn, startDate]);

  if (reject) {
    return (
      <div className="centered-h-v">
        <div className="width-50 alert alert-danger">
          Please ask your task provider to enable the firestore database before logging in online.
        </div>
      </div>
    );
  } else {
    return (
      <>
        {loggedIn ? (
          <JsPsychExperiment
            dataUpdateFunction={
              {
                desktop: desktopUpdateFunction,
                firebase: firebaseUpdateFunction,
                mturk: psiturkUpdateFunction,
                default: defaultFunction,
              }[currentMethod]
            }
            dataFinishFunction={
              {
                desktop: desktopFinishFunction,
                mturk: psiturkFinishFunction,
                firebase: defaultFunction,
                default: defaultFunction,
              }[currentMethod]
            }
          />
        ) : (
          <Login
            validationFunction={
              {
                desktop: defaultValidation,
                default: defaultValidation,
                firebase: firebaseValidation,
              }[currentMethod]
            }
            envParticipantId={envParticipantId}
            envStudyId={envStudyId}
            onLogin={setLoggedIn}
          />
        )}
      </>
    );
  }
  
}

export default App;
