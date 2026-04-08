// https://vitepress.dev/guide/custom-theme
import Layout from './Layout.vue'
import type { Theme } from 'vitepress'

import './style.css'
import './fonts/style.css'

import 'vitepress/dist/client/theme-default/styles/vars.css'
import 'vitepress/dist/client/theme-default/styles/components/vp-code.css'

import InlineImage from './components/InlineImage.vue'
import GraphView from './components/GraphView.vue'
import SecretPlayer from './components/SecretPlayer.vue'
import SecretDashboard from './components/SecretDashboard.vue'
import NowPlaying from './components/NowPlaying.vue'
import AMA from './components/AMA.vue'

export default {
	Layout,

	enhanceApp({ app, router, siteData }) {
		app.component('InlineImage', InlineImage)
		app.component('GraphView', GraphView)
		app.component('SecretPlayer', SecretPlayer)
		app.component('SecretDashboard', SecretDashboard)
		app.component('NowPlaying', NowPlaying)
		app.component('AMA', AMA)
	},
} satisfies Theme
