import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory
} from '../node_modules/@google/generative-ai/dist/index.mjs';

import geeseMessages from "./data";

let generationConfig = {
  temperature: 1
};

document.getElementById("requestAPI").style.display = "none";

chrome.storage.sync.get(['api'], function(result){
    
  if (!chrome.runtime.error) {

    if (result.api == undefined)
    {
      api = '...';
      document.getElementById("mainContent").style.display = "none";
      document.getElementById("requestAPI").style.display = "block";
      return;
    }

    apiKey = result.api;
  }
  
});

chrome.storage.sync.get(['todolist'], function(result){
  
  if (!chrome.runtime.error) {
    todoNodes = result.todolist;

    if (todoNodes == undefined)
    {
      todoNodes = [];
      return;
    }
    
    for (let i = 0; i < todoNodes.length; i ++)
    {
       createTodoItem(todoNodes[i]);
    }
  }
  
});

chrome.storage.sync.get(['anger'], function(result){
  
  if (!chrome.runtime.error) {
    anger = Number(result.anger);

    if (anger == undefined || isNaN(anger))
    {
      anger = 0;
    }

    angerText.textContent = "Anger: " + (anger + 1);
    geeseImg.src = geeseMessages[anger].path;
  }
  
});

let apiKey = '...';
let todoNodes = [];

let anger = 0;

let startTime = 0;
let isProductive = null;

let genAI = null;
let model = null;


document.getElementById('goToStats').addEventListener('click', function() {
  window.location.href = 'stats.html';
});

const elementResponse = document.body.querySelector('#response');
const elementLoading = document.body.querySelector('#loading');
const elementError = document.body.querySelector('#error');

const elementAddToDo = document.body.querySelector('#addToDo');
const elementAddAPI = document.body.querySelector('#addAPI');

const angerText = document.body.querySelector('#anger');
const geeseImg = document.body.querySelector("#geese");

elementAddToDo.addEventListener('click', () => {
  var inputValue = document.getElementById("inputToDo").value;

  if (inputValue === '' || todoNodes.includes(inputValue)) 
    return;

  createTodoItem(inputValue);

  todoNodes.push(inputValue);

  chrome.storage.sync.set({ "todolist": todoNodes }, function(){
    console.log("successfully updated todos");
  });
})

elementAddAPI.addEventListener('click', () => {
  var inputValue = document.getElementById("inputAPI").value;

  chrome.storage.sync.set({ "api": inputValue }, function(){
    console.log("successfully updated API key");
  });
})

function initModel(generationConfig) {
  const safetySettings = [
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_NONE
    }
  ];
  genAI = new GoogleGenerativeAI(apiKey);
  model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    safetySettings,
    generationConfig
  });
  return model;
}

async function runPrompt(prompt) {
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const formattedResponse = response.text().replace(/\./g, "").toLowerCase();

    let elapsed = 0;
    let accumulationKey = "";

    if (isProductive == null)
    {
      startTime = Date.now();
    }
    else{

      if (isProductive)
      {
        accumulationKey = "totalProductive";
      }
      else{
        accumulationKey = "totalUnproductive";
      }

      elapsed= Date.now() - startTime;
      startTime = Date.now();
    }
    
    if (formattedResponse.trim() === "no")
    {
      isProductive = false;
      setAnger(anger + 1, accumulationKey, elapsed);

      const passIndex = encodeURIComponent(anger);
      window.open(chrome.runtime.getURL(`./sidepanel/popup.html?data=${passIndex}`), "extension_popup", `width=${geeseMessages[anger].w} height=${geeseMessages[anger].h},status=no,scrollbars=yes,resizable=no`);
    }
    else{
      isProductive = true;
      setAnger(anger - 1, accumulationKey, elapsed);
    }

    return response.text();
  } catch (e) {
    console.log('Prompt failed');
    console.error(e);
    console.log('Prompt:', prompt);
    throw e;
  }
}

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse){
    getResponse(request.content);
  }
);

async function getResponse(webPageHeader)
{
  let concatToDos = "";

  for (let i = 0; i < todoNodes.length; i ++)
  {
    if (i < todoNodes.length - 1)
    {
      concatToDos += todoNodes[i] + ", ";
    }
    else{
      concatToDos += todoNodes[i] + ". ";
    }
  }

  const prompt = constructPrompt(webPageHeader, concatToDos);

  showLoading();
  try {
    const generationConfig = {
      temperature: 1
    };
    initModel(generationConfig);
    const response = await runPrompt(prompt, generationConfig);
    showResponse(response);
  } catch (e) {
    showError(e);
  }
}

function constructPrompt(pageTitle, todoList)
{
  const basePrompt = "This message is a title of a page the user is on. Based on this title, is the user currently on a web page that will help them be productive, achieve or learn things" +
                      "in their todo list? Give your repsponse as a yes (the user is being productive) or no (the user is not being productive) answer only there is no need for any explanations." + 
                      `The title of the page the user is on is called: ${pageTitle} and the items on their todolist are: ${todoList}`;
  return basePrompt;
}

function showLoading() {
  hide(elementResponse);
  hide(elementError);
  show(elementLoading);
}

function showResponse(response) {

  hide(elementLoading);
  show(elementResponse);
  // Make sure to preserve line breaks in the response
  elementResponse.textContent = '';
  const paragraphs = response.split(/\r?\n/);
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    if (paragraph) {
      elementResponse.appendChild(document.createTextNode(paragraph));
    }
    // Don't add a new line after the final paragraph
    if (i < paragraphs.length - 1) {
      elementResponse.appendChild(document.createElement('BR'));
    }
  }
}

function showError(error) {
  show(elementError);
  hide(elementResponse);
  hide(elementLoading);
  elementError.textContent = error;
}

function show(element) {
  element.removeAttribute('hidden');
}

function hide(element) {
  element.setAttribute('hidden', '');
}

function createTodoItem(task)
{
  var li = document.createElement("li");

  var t = document.createElement('p');
  t.innerHTML = task;
  t.className = "text-lg text-secondary";
  li.appendChild(t);

  var button = document.createElement("button");
  button.innerHTML = 'x';
  button.className = "btn"
  button.onclick = function()
  {
    const index = todoNodes.indexOf(task);
    todoNodes.splice(index, 1);

    chrome.storage.sync.set({ "todolist": todoNodes }, function(){
      console.log("successfully removed task");
    });

    li.remove();
    t.remove();
    button.remove();
  }

  li.appendChild(button);
  li.className = "todoItem";
  document.getElementById("toDoContents").appendChild(li);
}

function setAnger(change, key, elapsed)
{
  anger = change;
  anger = Math.min(anger, 4);
  anger = Math.max(anger, 0);

  chrome.storage.sync.set({ "anger": Number(anger) }, function(){
    console.log("successfully updated anger");
  });


  chrome.storage.sync.get([key], function(result){
  
    if (!chrome.runtime.error) {
      let temp = Number(result[key]);
      if (!(temp == undefined || isNaN(temp)))
      {
        elapsed += temp;
      }

      chrome.storage.sync.set({ [key] : elapsed }, function(){ console.log ("saved: " + elapsed) });
    }
    
    
  });     

  angerText.textContent = "Anger: " + (anger + 1);
  geeseImg.src = geeseMessages[anger].path;
}

