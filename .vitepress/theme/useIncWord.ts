import { ref } from 'vue'

const words = [
  'Inc.',
  'Industries',
  'Intelligence',
  'Innovations',
  'Incorporated',
  'International',
  'Infrastructure',
  'I Have No Idea What I\'m Doing',
  'Intelligence Not Found',
  'It Compiles!!!!!!!!',
  'It Synthesizes!',
  'I Think Therefore I Am',
  'I Think, Maybe',
  'Intellectual Property',
  'I\'ll Figure It Out',
  'Imposter Syndrome',
  'In Progress...',
  'Ideation Phase',
]

function pick() {
  return words[Math.floor(Math.random() * words.length)]
}

const incWord = ref(pick())

export function useIncWord() {
  return incWord
}

export function rerollIncWord() {
  let next = pick()
  while (next === incWord.value) next = pick()
  incWord.value = next
}
