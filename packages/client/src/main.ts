import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';

const appElement = document.getElementById('app');
if (!appElement) {
  throw new Error('Could not find #app element in DOM');
}

const app = mount(App, {
  target: appElement,
});

export default app;

