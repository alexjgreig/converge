import React from 'react'
import {
  Button,
  Card,
  Grid,
  Message,
  Modal,
  Form,
  Image,
  Label,
} from 'semantic-ui-react'

import { useSubstrateState } from './substrate-lib'
import { TxButton } from './substrate-lib/components'

// --- Transfer Modal ---

const TransferModal = props => {
  const { nft, setStatus } = props
  const [open, setOpen] = React.useState(false)
  const [formValue, setFormValue] = React.useState({})

  const formChange = key => (ev, el) => {
    setFormValue({ ...formValue, [key]: el.value })
  }

  const confirmAndClose = unsub => {
    setOpen(false)
    if (unsub && typeof unsub === 'function') unsub()
  }

  return (
    <Modal
      onClose={() => setOpen(false)}
      onOpen={() => setOpen(true)}
      open={open}
      trigger={
        <Button basic color="blue">
          Transfer
        </Button>
      }
    >
      <Modal.Header>NFT Transfer</Modal.Header>
      <Modal.Content>
        <Form>
          <Form.Input fluid label="NFT ID" readOnly value={nft.proof} />
          <Form.Input
            fluid
            label="Receiver"
            placeholder="Receiver Address"
            onChange={formChange('target')}
          />
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <Button basic color="grey" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <TxButton
          label="Transfer"
          type="SIGNED-TX"
          setStatus={setStatus}
          onClick={confirmAndClose}
          attrs={{
            palletRpc: 'substrateNfts',
            callable: 'transfer',
            inputParams: [formValue.target, nft.proof],
            paramFields: [true, true],
          }}
        />
      </Modal.Actions>
    </Modal>
  )
}

// --- Set Price ---

const SetPrice = props => {
  const { nft, setStatus } = props
  const [open, setOpen] = React.useState(false)
  const [formValue, setFormValue] = React.useState({})

  const formChange = key => (ev, el) => {
    setFormValue({ ...formValue, [key]: el.value })
  }

  const confirmAndClose = unsub => {
    setOpen(false)
    if (unsub && typeof unsub === 'function') unsub()
  }

  return (
    <Modal
      onClose={() => setOpen(false)}
      onOpen={() => setOpen(true)}
      open={open}
      trigger={
        <Button basic color="blue">
          Set Price
        </Button>
      }
    >
      <Modal.Header>Set NFT Price</Modal.Header>
      <Modal.Content>
        <Form>
          <Form.Input fluid label="NFT ID" readOnly value={nft.proof} />
          <Form.Input
            fluid
            label="Price"
            placeholder="Enter Price"
            onChange={formChange('target')}
          />
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <Button basic color="grey" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <TxButton
          label="Set Price"
          type="SIGNED-TX"
          setStatus={setStatus}
          onClick={confirmAndClose}
          attrs={{
            palletRpc: 'substrateNfts',
            callable: 'setPrice',
            inputParams: [nft.proof, formValue.target],
            paramFields: [true, true],
          }}
        />
      </Modal.Actions>
    </Modal>
  )
}

// --- Buy NFT ---

const BuyNFT = props => {
  const { nft, setStatus } = props
  const [open, setOpen] = React.useState(false)

  const confirmAndClose = unsub => {
    setOpen(false)
    if (unsub && typeof unsub === 'function') unsub()
  }

  if (!nft.price) {
    return <></>
  }

  return (
    <Modal
      onClose={() => setOpen(false)}
      onOpen={() => setOpen(true)}
      open={open}
      trigger={
        <Button basic color="green">
          Buy NFT
        </Button>
      }
    >
      <Modal.Header>Buy NFT</Modal.Header>
      <Modal.Content>
        <Form>
          <Form.Input fluid label="NFT ID" readOnly value={nft.proof} />
          <Form.Input fluid label="Price" readOnly value={nft.price} />
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <Button basic color="grey" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <TxButton
          label="Buy NFT"
          type="SIGNED-TX"
          setStatus={setStatus}
          onClick={confirmAndClose}
          attrs={{
            palletRpc: 'substrateNfts',
            callable: 'buyNft',
            inputParams: [nft.proof, nft.price],
            paramFields: [true, true],
          }}
        />
      </Modal.Actions>
    </Modal>
  )
}

// --- About NFT Card ---

const NFTCard = props => {
  const { nft, setStatus } = props
  const { proof = null, owner = null, name = null, price = null} = nft
  const displayProof = proof && proof.toJSON()
  const { currentAccount } = useSubstrateState()
  const isSelf = currentAccount.address === nft.owner

  return (
    <Card>
	{isSelf && (
        <Label as="a" floating color="teal">
          Mine
        </Label>
      )}
      <Image src='/img/doc.png' wrapped ui ={false} />
      <Card.Content>
	 <Card.Meta style={{ fontSize: '.9em', overflowWrap: 'break-word' }}>
          Proof: {displayProof}
        </Card.Meta> 
        <Card.Description>
          <p style={{ overflowWrap: 'break-word' }}>Owner: {owner}</p>
          <p style={{ overflowWrap: 'break-word' }}>Name: {name}</p>
          <p style={{ overflowWrap: 'break-word' }}>
            Price: {price || 'Not For Sale'}
          </p>
        </Card.Description>
      </Card.Content>
      <Card.Content extra style={{ textAlign: 'center' }}>
        {owner === currentAccount.address ? (
          <>
            <SetPrice nft={nft} setStatus={setStatus} />
            <TransferModal nft={nft} setStatus={setStatus} />
          </>
        ) : (
          <>
            <BuyNFT nft={nft} setStatus={setStatus} />
          </>
        )}
      </Card.Content>
    </Card>
  )
}

const NFTCards = props => {
  const { nfts, setStatus } = props

  if (nfts.length === 0) {
    return (
      <Message info>
        <Message.Header>
          No NFTs Created... Create one now!&nbsp;
          <span role="img" aria-label="point-down">
            👇
          </span>
        </Message.Header>
      </Message>
    )
  }

  return (
    <Grid columns={3}>
      {nfts.map((nft, i) => (
        <Grid.Column key={`nft-${i}`}>
          <NFTCard nft={nft} setStatus={setStatus} />
        </Grid.Column>
      ))}
    </Grid>
  )
}

export default NFTCards
