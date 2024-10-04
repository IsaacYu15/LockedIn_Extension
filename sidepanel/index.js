import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory
} from '../node_modules/@google/generative-ai/dist/index.mjs';

let apiKey = '...';
let todoNodes = [];
let anger = 0;

let genAI = null;
let model = null;
let generationConfig = {
  temperature: 1
};

const elementResponse = document.body.querySelector('#response');
const elementLoading = document.body.querySelector('#loading');
const elementError = document.body.querySelector('#error');

const elementAddToDo = document.body.querySelector('#addToDo');
const elementAddAPI = document.body.querySelector('#addAPI');

const angerText = document.body.querySelector('#anger');

//retrieve the old todos and api key
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

chrome.storage.sync.get(['api'], function(result){
  
  if (!chrome.runtime.error) {
    apiKey = result.api;
    if (apiKey == undefined)
    {
      api = '...';
      return;
    }
  }
  
});

chrome.storage.sync.get(['anger'], function(result){
  
  if (!chrome.runtime.error) {
    anger = Number(result.anger);
    angerText.textContent = "Anger: " + anger;
    if (anger == undefined || isNaN(anger))
    {
      anger = 0;
      return;
    }
  }
  
});


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
    console.log(formattedResponse);

    if (formattedResponse.trim() === "no")
    {
      console.log("ANGER");
      setAnger(anger + 1);
    }
    else{
      setAnger(anger - 1);
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

elementAddToDo.addEventListener('click', () => {
  var inputValue = document.getElementById("inputToDo").value;

  if (inputValue === '') 
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

function createTodoItem(task)
{
  var li = document.createElement("li");

  var t = document.createTextNode(task);
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

  document.getElementById("toDoContents").appendChild(li);
}

function setAnger(change)
{
  anger = change;
  anger = Math.min(anger, 5);
  anger = Math.max(anger, 0);

  chrome.storage.sync.set({ "anger": Number(anger) }, function(){
    console.log("successfully updated anger");
  });
  angerText.textContent = "Anger: " + anger;
}
